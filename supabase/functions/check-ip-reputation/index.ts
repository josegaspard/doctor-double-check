// Veredicto de VPN / proxy / datacenter / Tor sobre la IP del visitante
// (cliente 2026-08-28: «hay que bloquear VPN falsas»).
//
// Cómo funciona:
//   1. Lee la IP real (x-forwarded-for) y consulta proxycheck.io.
//   2. Guarda SIEMPRE el veredicto en public.ip_reputation_log (lo ve el admin).
//   3. Sólo BLOQUEA si Admin → Ajustes del sitio → «Bloquear registro desde
//      VPN / proxy» está encendido, y la IP no está en public.ip_allowlist.
//   4. Si el proveedor falla o no hay clave, deja pasar (fail-open): un
//      detector caído nunca debe impedir que un médico se registre.
//
// Secret opcional: PROXYCHECK_API_KEY (sin clave, proxycheck.io permite 100
// consultas/día por IP de origen; con clave gratuita, 1.000/día).

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface Reputation {
  is_vpn: boolean;
  is_proxy: boolean;
  is_hosting: boolean;
  is_tor: boolean;
  country: string | null;
  asn: string | null;
  org: string | null;
  provider: string;
  raw: unknown;
}

async function lookup(ip: string): Promise<Reputation | null> {
  const key = Deno.env.get("PROXYCHECK_API_KEY") ?? "";
  const url = `https://proxycheck.io/v2/${encodeURIComponent(ip)}?vpn=1&asn=1&risk=0${key ? `&key=${encodeURIComponent(key)}` : ""}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const data = await res.json();
    const r = data?.[ip];
    if (!r || data?.status === "error" || data?.status === "denied") return null;
    // proxycheck: proxy = "yes"/"no"; type = "VPN" | "TOR" | "Compromised Server" | "Hosting" | ...
    const type = String(r.type ?? "").toLowerCase();
    const isProxy = r.proxy === "yes";
    return {
      is_vpn: isProxy && type.includes("vpn"),
      is_proxy: isProxy && !type.includes("vpn") && !type.includes("tor"),
      is_hosting: type.includes("hosting") || type.includes("server"),
      is_tor: type.includes("tor"),
      country: r.isocode ?? r.country ?? null,
      asn: r.asn ?? null,
      org: r.provider ?? r.organisation ?? null,
      provider: "proxycheck.io",
      raw: r,
    };
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    let body: { action?: string; email?: string } = {};
    try { body = await req.json(); } catch (_) { /* cuerpo vacío */ }
    const action = body.action === "login" || body.action === "check" ? body.action : "signup";
    const email = typeof body.email === "string" ? body.email.slice(0, 254).toLowerCase() : null;

    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim()
      || req.headers.get("cf-connecting-ip")
      || "";

    // Sin IP no hay veredicto: se deja pasar y se anota.
    if (!ip || ip === "unknown") {
      await admin.from("ip_reputation_log").insert({
        ip: null, email, action, verdict: "allow", provider: "none", raw: { reason: "no_ip" },
      });
      return json({ allow: true, verdict: "allow", reason: "no_ip" });
    }

    // ¿Está encendido el bloqueo?
    const { data: settings } = await admin
      .from("site_settings").select("value").eq("id", "feature_toggles").maybeSingle();
    const blockEnabled = (settings?.value as Record<string, unknown> | null)?.block_vpn_signup === true;

    // Lista blanca del admin: nunca se bloquea.
    const { data: white } = await admin.from("ip_allowlist").select("ip").eq("ip", ip).maybeSingle();
    const allowlisted = !!white;

    const rep = await lookup(ip);
    const suspicious = !!rep && (rep.is_vpn || rep.is_proxy || rep.is_tor || rep.is_hosting);

    let verdict: "allow" | "flag" | "block" = "allow";
    if (suspicious) verdict = blockEnabled && !allowlisted && action === "signup" ? "block" : "flag";

    await admin.from("ip_reputation_log").insert({
      ip,
      email,
      action,
      is_vpn: rep?.is_vpn ?? null,
      is_proxy: rep?.is_proxy ?? null,
      is_hosting: rep?.is_hosting ?? null,
      is_tor: rep?.is_tor ?? null,
      country: rep?.country ?? null,
      asn: rep?.asn ?? null,
      org: rep?.org ?? null,
      verdict,
      provider: rep?.provider ?? "none",
      raw: rep ? { ...(rep.raw as object), allowlisted, block_enabled: blockEnabled } : { reason: "lookup_failed", allowlisted, block_enabled: blockEnabled },
    });

    return json({
      allow: verdict !== "block",
      verdict,
      reason: verdict === "allow" ? "ok" : rep?.is_tor ? "tor" : rep?.is_vpn ? "vpn" : rep?.is_proxy ? "proxy" : "hosting",
    });
  } catch (err) {
    console.error("check-ip-reputation error", err);
    // fail-open
    return json({ allow: true, verdict: "allow", reason: "error" });
  }
});
