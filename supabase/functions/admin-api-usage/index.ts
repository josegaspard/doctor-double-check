// admin-api-usage — Consumo, saldo, peticiones, restante y ROI de cada API/
// servicio externo que paga la plataforma (Stripe, Cloudflare Stream, Daily.co,
// Bunny Stream, Backblaze B2). Solo admin.
//
// Diseño: cada proveedor se consulta en su propio try/catch y devuelve una
// tarjeta normalizada. Si una lectura falla (clave ausente, endpoint caído,
// permiso), la tarjeta sale con available:false y una nota — el panel NUNCA
// se rompe por un proveedor. Los costes se estiman con las tarifas públicas
// vigentes (editables en PRICING abajo) salvo Stripe, que reporta sus comisiones
// reales. El ingreso atribuido a cada servicio sale de la BD para calcular ROI.
//
// Monedas: los costes de los proveedores son USD; el ingreso de la plataforma
// es MXN. Para el ROI se convierte el coste a MXN con el tipo de cambio de la
// tabla exchange_rates (base MXN); si no hay, se usa USDMXN_FALLBACK.

import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireAdminJWT, corsHeadersFor, AuthError } from "../_shared/auth-guards.ts";

// --- Tarifas públicas (USD) usadas para ESTIMAR coste donde el proveedor no da
//     una factura por API. Ajustables sin tocar la lógica. ---
const PRICING = {
  daily: { perParticipantMin: 0.004 },                 // videollamadas (consultas)
  cloudflare: { storagePer1kMin: 5, deliveryPer1kMin: 1 }, // Stream (Lives)
  bunny: { storagePerGbMonth: 0.01, deliveryPerGb: 0.01 }, // Stream (vídeo bajo demanda)
  b2: { storagePerGbMonth: 0.006, downloadPerGb: 0.01 },   // almacenamiento de grabaciones/docs
};
const USDMXN_FALLBACK = 18.0;

type Card = {
  key: string; name: string; billing: string; unit: string | null;
  usage: number | null; requests: number | null;
  consumedUsd: number | null; balanceUsd: number | null; remaining: string;
  revenueMxn: number; available: boolean; note: string;
};

const nz = (n: unknown) => (typeof n === "number" && isFinite(n) ? n : 0);

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    await requireAdminJWT(req);
  } catch (e) {
    if (e instanceof AuthError) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: e.status, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "auth failed" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let days = 30;
  try { const b = await req.json(); if (b?.days && Number(b.days) > 0) days = Math.min(365, Number(b.days)); } catch { /* sin body */ }
  const sinceMs = Date.now() - days * 86400_000;
  const sinceIso = new Date(sinceMs).toISOString();

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // --- Tipo de cambio USD→MXN ---
  let usdMxn = USDMXN_FALLBACK;
  try {
    const { data } = await admin.from("exchange_rates").select("rate").eq("target_currency", "USD").maybeSingle();
    // rate = USD por 1 MXN → 1 USD = 1/rate MXN
    if (data?.rate && Number(data.rate) > 0) usdMxn = 1 / Number(data.rate);
  } catch { /* usa fallback */ }
  const toMxn = (usd: number) => usd * usdMxn;

  // --- Ingreso de la plataforma en el periodo (para ROI) ---
  const rev = { consultations: 0, content: 0, subscriptions: 0, marketplace: 0, gross: 0 };
  try {
    const [{ data: tx }, { data: purchases }, { data: subs }, { data: orders }] = await Promise.all([
      admin.from("wallet_transactions").select("amount, type, metadata").eq("status", "paid").gte("created_at", sinceIso),
      admin.from("purchases").select("amount").gte("created_at", sinceIso),
      admin.from("subscriptions").select("price_paid").eq("is_active", true).gte("created_at", sinceIso),
      admin.from("marketplace_orders").select("total_amount").in("status", ["paid", "shipped", "delivered"]).gte("created_at", sinceIso),
    ]);
    rev.consultations = (tx ?? []).filter((t: any) => t.type === "earning" && t.metadata?.source === "consultation").reduce((s: number, t: any) => s + nz(Number(t.amount)), 0);
    rev.content = (purchases ?? []).reduce((s: number, p: any) => s + nz(Number(p.amount)), 0);
    rev.subscriptions = (subs ?? []).reduce((s: number, x: any) => s + nz(Number(x.price_paid)), 0);
    rev.marketplace = (orders ?? []).reduce((s: number, o: any) => s + nz(Number(o.total_amount)), 0);
    rev.gross = rev.consultations + rev.content + rev.subscriptions + rev.marketplace;
  } catch { /* ingresos a 0 si falla */ }

  const cards: Card[] = [];

  // ===== STRIPE (datos reales: saldo + volumen + comisiones) =====
  {
    const card: Card = { key: "stripe", name: "Stripe", billing: "Comisión por cobro", unit: "cobros", usage: null, requests: null, consumedUsd: null, balanceUsd: null, remaining: "—", revenueMxn: rev.gross, available: false, note: "" };
    try {
      const sk = Deno.env.get("STRIPE_SECRET_KEY");
      if (!sk) throw new Error("sin STRIPE_SECRET_KEY");
      const stripe = new Stripe(sk, { apiVersion: "2025-03-31.basil" });
      const balance = await stripe.balance.retrieve();
      const available = (balance.available ?? []).reduce((s, b) => s + b.amount, 0) / 100;
      const pending = (balance.pending ?? []).reduce((s, b) => s + b.amount, 0) / 100;

      // Comisiones y volumen del periodo desde balance_transactions (paginado, tope 1000).
      let feeTotal = 0, grossTotal = 0, count = 0, startingAfter: string | undefined;
      for (let page = 0; page < 10; page++) {
        const bt: any = await stripe.balanceTransactions.list({ created: { gte: Math.floor(sinceMs / 1000) }, limit: 100, ...(startingAfter ? { starting_after: startingAfter } : {}) });
        for (const t of bt.data) { feeTotal += nz(t.fee) / 100; if (t.type === "charge" || t.type === "payment") { grossTotal += nz(t.amount) / 100; count++; } }
        if (!bt.has_more || bt.data.length === 0) break;
        startingAfter = bt.data[bt.data.length - 1].id;
      }
      card.available = true;
      card.billing = "Comisión por cobro";
      card.unit = "cobros";
      card.usage = count;
      card.requests = count;
      // Los importes de Stripe ya vienen en la moneda de la cuenta (MXN para una
      // cuenta mexicana): NO se convierten. El volumen procesado es el "ingreso"
      // que Stripe habilita, base del ROI de la pasarela.
      card.consumedUsd = feeTotal;                 // comisiones pagadas = coste real (MXN)
      card.balanceUsd = available;                 // saldo disponible (MXN)
      card.revenueMxn = grossTotal;                // volumen procesado (MXN)
      card.remaining = `Disponible ${new Intl.NumberFormat("es-MX").format(Math.round(available))} MXN · en tránsito ${new Intl.NumberFormat("es-MX").format(Math.round(pending))}`;
      card.note = `${count} cobros · volumen ${grossTotal.toFixed(0)} · comisión ${feeTotal.toFixed(2)}`;
    } catch (e) { card.note = `No se pudo leer: ${String((e as Error).message).slice(0, 80)}`; }
    cards.push(card);
  }

  // ===== CLOUDFLARE STREAM (Lives) =====
  {
    const card: Card = { key: "cloudflare", name: "Cloudflare Stream", billing: "Por uso (postpago)", unit: "minutos", usage: null, requests: null, consumedUsd: null, balanceUsd: null, remaining: "Sin saldo (postpago)", revenueMxn: rev.subscriptions + rev.content, available: false, note: "" };
    try {
      const acc = Deno.env.get("CLOUDFLARE_ACCOUNT_ID"); const tok = Deno.env.get("CLOUDFLARE_API_TOKEN");
      if (!acc || !tok) throw new Error("sin credenciales Cloudflare");
      // Minutos almacenados (catálogo de vídeos) + nº de vídeos.
      const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acc}/stream?per_page=1000`, { headers: { Authorization: `Bearer ${tok}` } });
      const j = await r.json();
      if (!j.success) throw new Error(j.errors?.[0]?.message || "stream list falló");
      const videos = j.result ?? [];
      const storedMin = videos.reduce((s: number, v: any) => s + nz(v.duration) / 60, 0);
      // Minutos entregados en el periodo (analytics GraphQL).
      let deliveredMin = 0;
      try {
        const gql = await fetch("https://api.cloudflare.com/client/v4/graphql", {
          method: "POST", headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
          body: JSON.stringify({ query: `query($a:String!,$s:Time!){viewer{accounts(filter:{accountTag:$a}){streamMinutesViewedAdaptiveGroups(filter:{datetime_geq:$s},limit:1){sum{minutesViewed}}}}}`, variables: { a: acc, s: sinceIso } }),
        });
        const gj = await gql.json();
        deliveredMin = nz(gj?.data?.viewer?.accounts?.[0]?.streamMinutesViewedAdaptiveGroups?.[0]?.sum?.minutesViewed);
      } catch { /* analytics opcional */ }
      const costUsd = (storedMin / 1000) * PRICING.cloudflare.storagePer1kMin + (deliveredMin / 1000) * PRICING.cloudflare.deliveryPer1kMin;
      card.available = true;
      card.unit = "min almacenados";
      card.usage = Math.round(storedMin);
      card.requests = videos.length;
      card.consumedUsd = costUsd;
      card.note = `${videos.length} vídeos · ${Math.round(storedMin)} min guardados · ${Math.round(deliveredMin)} min vistos (${days}d)`;
    } catch (e) { card.note = `No se pudo leer: ${String((e as Error).message).slice(0, 80)}`; }
    cards.push(card);
  }

  // ===== DAILY.CO (consultas por vídeo) =====
  {
    const card: Card = { key: "daily", name: "Daily.co", billing: "Por minuto (postpago)", unit: "salas", usage: null, requests: null, consumedUsd: null, balanceUsd: null, remaining: "Sin saldo (postpago)", revenueMxn: rev.consultations, available: false, note: "" };
    try {
      const k = Deno.env.get("DAILY_API_KEY"); if (!k) throw new Error("sin DAILY_API_KEY");
      // Reuniones del periodo con minutos-participante (endpoint de uso de Daily).
      const r = await fetch(`https://api.daily.co/v1/meetings?limit=100`, { headers: { Authorization: `Bearer ${k}` } });
      const j = await r.json();
      if (j.error) throw new Error(j.info || j.error);
      const meetings = j.data ?? [];
      let partMin = 0, sessions = 0;
      for (const m of meetings) {
        if (m.start_time && m.start_time * 1000 < sinceMs) continue;
        sessions++;
        const dur = nz(m.duration);
        const parts = Array.isArray(m.participants) ? m.participants.length : nz(m.max_participants) || 1;
        partMin += (dur / 60) * parts;
      }
      const costUsd = partMin * PRICING.daily.perParticipantMin;
      card.available = true;
      card.unit = "min-participante";
      card.usage = Math.round(partMin);
      card.requests = sessions;
      card.consumedUsd = costUsd;
      card.note = `${sessions} reuniones · ${Math.round(partMin)} min-participante (${days}d)`;
    } catch (e) { card.note = `No se pudo leer: ${String((e as Error).message).slice(0, 80)}`; }
    cards.push(card);
  }

  // ===== BUNNY STREAM (vídeo bajo demanda) =====
  {
    const card: Card = { key: "bunny", name: "Bunny Stream", billing: "Prepago (saldo de cuenta)", unit: "min vistos", usage: null, requests: null, consumedUsd: null, balanceUsd: null, remaining: "Saldo solo con clave de cuenta", revenueMxn: rev.content, available: false, note: "" };
    try {
      const key = Deno.env.get("BUNNY_STREAM_API_KEY"); const lib = Deno.env.get("BUNNY_STREAM_LIBRARY_ID");
      if (!key || !lib) throw new Error("sin credenciales Bunny Stream");
      const r = await fetch(`https://video.bunnycdn.com/library/${lib}/statistics`, { headers: { AccessKey: key } });
      const j = await r.json();
      if (j.HttpStatusCode && j.HttpStatusCode >= 400) throw new Error(j.Message || "statistics falló");
      const watchMin = nz(j.totalWatchTime ?? j.WatchTime);                 // minutos vistos (según API)
      const views = nz(j.totalViewsCount ?? j.ViewsCount);
      // Coste aproximado por entrega; el almacenamiento necesita la clave de cuenta.
      const deliveredGb = (watchMin / 60) * 0.5; // ~0.5 GB/hora a calidad media
      const costUsd = deliveredGb * PRICING.bunny.deliveryPerGb;
      card.available = true;
      card.usage = Math.round(watchMin);
      card.requests = views;
      card.consumedUsd = costUsd;
      card.note = `${views} reproducciones · ${Math.round(watchMin)} min vistos (histórico)`;
    } catch (e) { card.note = `No se pudo leer: ${String((e as Error).message).slice(0, 80)}`; }
    cards.push(card);
  }

  // ===== BACKBLAZE B2 (almacenamiento de grabaciones/documentos) =====
  {
    const card: Card = { key: "b2", name: "Backblaze B2", billing: "Por uso (postpago)", unit: "GB guardados", usage: null, requests: null, consumedUsd: null, balanceUsd: null, remaining: "Sin saldo (postpago)", revenueMxn: rev.content, available: false, note: "" };
    try {
      const keyId = Deno.env.get("B2_KEY_ID"); const appKey = Deno.env.get("B2_APPLICATION_KEY"); const bucket = Deno.env.get("B2_BUCKET");
      if (!keyId || !appKey) throw new Error("sin credenciales B2");
      // Autorización nativa de B2 → tamaño del bucket vía list (tope de muestreo).
      const auth = await fetch("https://api.backblazeb2.com/b2api/v3/b2_authorize_account", { headers: { Authorization: "Basic " + btoa(`${keyId}:${appKey}`) } });
      const aj = await auth.json();
      if (!aj.apiInfo?.storageApi?.apiUrl) throw new Error(aj.message || "auth B2 falló");
      const apiUrl = aj.apiInfo.storageApi.apiUrl; const token = aj.authorizationToken;
      // Buscar el bucketId por nombre.
      const lb = await fetch(`${apiUrl}/b2api/v3/b2_list_buckets`, { method: "POST", headers: { Authorization: token, "Content-Type": "application/json" }, body: JSON.stringify({ accountId: aj.accountId, ...(bucket ? { bucketName: bucket } : {}) }) });
      const lbj = await lb.json();
      const b = (lbj.buckets ?? [])[0];
      let bytes = 0, files = 0;
      if (b?.bucketId) {
        // Suma hasta 10k ficheros (muestra; para cuentas grandes B2 da métricas en su panel).
        let nextName: string | undefined; let nextId: string | undefined;
        for (let page = 0; page < 10; page++) {
          const lf: any = await (await fetch(`${apiUrl}/b2api/v3/b2_list_file_versions`, { method: "POST", headers: { Authorization: token, "Content-Type": "application/json" }, body: JSON.stringify({ bucketId: b.bucketId, maxFileCount: 1000, ...(nextName ? { startFileName: nextName, startFileId: nextId } : {}) }) })).json();
          for (const f of lf.files ?? []) { bytes += nz(f.contentLength); files++; }
          if (!lf.nextFileName) break; nextName = lf.nextFileName; nextId = lf.nextFileId;
        }
      }
      const gb = bytes / 1e9;
      const costUsd = gb * PRICING.b2.storagePerGbMonth;
      card.available = true;
      card.usage = Math.round(gb * 100) / 100;
      card.requests = files;
      card.consumedUsd = costUsd;
      card.note = `${files} ficheros · ${(gb).toFixed(2)} GB${b?.bucketName ? " · " + b.bucketName : ""}`;
    } catch (e) { card.note = `No se pudo leer: ${String((e as Error).message).slice(0, 80)}`; }
    cards.push(card);
  }

  // --- Totales y ROI ---
  const out = cards.map((c) => {
    // Stripe informa ya en MXN (moneda de la cuenta); el resto cobra en USD y se convierte.
    const currency = c.key === "stripe" ? "MXN" : "USD";
    const costMxn = c.consumedUsd == null ? null : (currency === "MXN" ? c.consumedUsd : toMxn(c.consumedUsd));
    const roi = costMxn && costMxn > 0 ? c.revenueMxn / costMxn : null; // múltiplo de retorno
    const netMxn = costMxn != null ? c.revenueMxn - costMxn : null;
    return { ...c, currency, costMxn, netMxn, roi };
  });
  const totalCostMxn = out.reduce((s, c) => s + nz(c.costMxn), 0);
  const totalRevenueMxn = rev.gross;

  return new Response(JSON.stringify({
    generatedAt: new Date().toISOString(),
    days, usdMxn,
    revenue: rev,
    totals: { costMxn: totalCostMxn, revenueMxn: totalRevenueMxn, netMxn: totalRevenueMxn - totalCostMxn, roi: totalCostMxn > 0 ? totalRevenueMxn / totalCostMxn : null },
    providers: out,
  }), { headers: { ...cors, "Content-Type": "application/json" } });
});
