// Endpoint público de escaneo de QR (invitaciones impresas a médicos).
//
// El QR impreso apunta a https://medical-masters.com/qr?c=<slug> (rewrite de Vercel
// hacia esta función). Aquí:
//   1) Registramos UNA fila en public.qr_scans con el service-role (RLS no bloquea).
//   2) Redirigimos 302 al destino de la campaña con parámetros UTM, para que GA4
//      también cuente la visita (source/medium/campaign).
//
// verify_jwt = false (ver supabase/config.toml): es público por diseño; lo escanea
// cualquiera con su celular, sin sesión. NUNCA bloqueamos la redirección: si el insert
// falla, el médico igual llega al sitio. No guardamos PII (ip_hash = sha256 no reversible).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APP_URL = "https://medical-masters.com";
const DEFAULT_SLUG = "doctores-invitacion-2026";

// Defaults por si el slug no existe en la tabla (la redirección nunca debe romperse).
const FALLBACK = {
  destination_path: "/",
  utm_source: "invitacion-impresa",
  utm_medium: "qr",
  utm_campaign: "qr",
};

// sha256(ip|ua) truncado a 32 hex chars. Sirve solo para estimar personas únicas;
// no es reversible ni permite re-identificar a nadie.
async function hashVisitor(ip: string, ua: string): Promise<string | null> {
  try {
    const data = new TextEncoder().encode(`${ip}|${ua}`);
    const buf = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 32);
  } catch {
    return null;
  }
}

function redirect(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      // No cachear la redirección: cada escaneo debe volver a pasar por la función.
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const slug = (url.searchParams.get("c") || DEFAULT_SLUG).trim().slice(0, 80);

  // Metadatos del request (no PII).
  const ua = (req.headers.get("user-agent") || "").slice(0, 500);
  const referer = (req.headers.get("referer") || "").slice(0, 500);
  const ip =
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    req.headers.get("cf-connecting-ip") ||
    "";
  const country =
    req.headers.get("x-vercel-ip-country") ||
    req.headers.get("cf-ipcountry") ||
    null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  let dest = { ...FALLBACK };

  try {
    const supabase = createClient(supabaseUrl, serviceKey);

    // Buscar la campaña (destino + UTM). Si no existe, usar FALLBACK.
    const { data: campaign } = await supabase
      .from("qr_campaigns")
      .select("destination_path, utm_source, utm_medium, utm_campaign, active")
      .eq("slug", slug)
      .maybeSingle();

    if (campaign) {
      dest = {
        destination_path: campaign.destination_path || FALLBACK.destination_path,
        utm_source: campaign.utm_source || FALLBACK.utm_source,
        utm_medium: campaign.utm_medium || FALLBACK.utm_medium,
        utm_campaign: campaign.utm_campaign || slug,
      };
    } else {
      dest.utm_campaign = slug;
    }

    // Registrar el escaneo (best-effort: si falla, seguimos a la redirección).
    const ip_hash = ip ? await hashVisitor(ip, ua) : null;
    await supabase.from("qr_scans").insert({
      campaign_slug: slug,
      user_agent: ua || null,
      referer: referer || null,
      ip_hash,
      country,
    });
  } catch (_e) {
    // Nunca romper la experiencia del que escanea: redirigimos igual.
    dest.utm_campaign = dest.utm_campaign || slug;
  }

  // Construir el destino final con UTM (mismo origen, homepage por defecto).
  const path = dest.destination_path.startsWith("/")
    ? dest.destination_path
    : `/${dest.destination_path}`;
  const target = new URL(path, APP_URL);
  target.searchParams.set("utm_source", dest.utm_source);
  target.searchParams.set("utm_medium", dest.utm_medium);
  target.searchParams.set("utm_campaign", dest.utm_campaign);

  return redirect(target.toString());
});
