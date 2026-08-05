// Public contact-form handler.
// The /contact page (and any anonymous visitor) posts here. We persist the
// message into `public.reports` via the service-role client — RLS would
// otherwise block anonymous inserts — and best-effort email the admins.
//
// verify_jwt = false (see supabase/config.toml): this endpoint is public by
// design. Abuse is bounded by input validation + length caps; admins triage
// everything in /admin/reports.

import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { renderEmail, detailTable } from "../_shared/email-template.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const APP_URL = "https://medical-masters.com";
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const clean = (s: unknown, max: number) =>
  String(s ?? "").replace(/[<>]/g, "").trim().slice(0, max);

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let payload: { name?: string; email?: string; subject?: string; message?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const name = clean(payload.name, 120);
  const email = clean(payload.email, 200);
  const subject = clean(payload.subject, 200) || "Mensaje desde el sitio";
  const message = clean(payload.message, 5000);

  if (!name || !email || !message) {
    return json({ error: "Faltan campos requeridos (nombre, email, mensaje)." }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Correo electrónico no válido." }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, serviceKey);

  // Rate-limit por IP (endpoint público): evita flood de la tabla `reports` y abuso
  // del email a admins. 5 envíos / hora por IP. Best-effort: si la RPC falla, deja pasar.
  const clientIp = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  try {
    const { data: allowed } = await supabase.rpc("check_and_record_rate_limit", {
      p_bucket: "submit_contact",
      p_key: clientIp,
      p_max: 5,
      p_window_seconds: 3600,
    });
    if (allowed === false) {
      return json({ error: "Demasiados envíos. Intenta de nuevo en un rato." }, 429);
    }
  } catch (_e) { /* no bloquear si el rate-limit falla */ }

  // 1. Persist the message so it shows up in /admin/reports.
  const { data: inserted, error: insertError } = await supabase
    .from("reports")
    .insert({
      reporter_id: NIL_UUID,
      content_type: "platform_report",
      content_id: null,
      reason: "contacto",
      subject,
      description: `De: ${name} <${email}>\n\n${message}`,
      contact_email: email,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("submit-contact insert failed", insertError);
    return json({ error: "No se pudo registrar el mensaje. Intenta de nuevo." }, 500);
  }

  // 2. Best-effort: email the admins. Never block the success response on this.
  try {
    // 2 pasos: traer user_id de admins, luego sus emails (no hay FK directa
    // user_roles->profiles, el embed profiles:profiles(email) daba HTTP 400).
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    const adminIds = (adminRoles ?? []).map((r: any) => r.user_id).filter(Boolean);
    let adminEmails: string[] = [];
    if (adminIds.length > 0) {
      const { data: adminProfiles } = await supabase
        .from("profiles")
        .select("email")
        .in("id", adminIds);
      adminEmails = (adminProfiles ?? [])
        .map((row: any) => row?.email)
        .filter((e: any) => typeof e === "string" && e.includes("@"));
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey && adminEmails.length > 0) {
      const resend = new Resend(resendKey);
      const escapedMsg = message
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>");
      await resend.emails.send({
        from: Deno.env.get("FROM_EMAIL") ?? "Medical Masters <noreply@notify.medical-masters.com>",
        to: adminEmails,
        reply_to: email,
        subject: `Contacto: ${subject}`,
        html: renderEmail({
          preheader: `Nuevo mensaje de contacto de ${name}`,
          accent: "info",
          eyebrow: "Nuevo contacto",
          title: subject,
          subtitle: "Mensaje recibido desde el formulario de contacto del sitio.",
          bodyHtml: `
            ${detailTable([["Nombre", name], ["Correo", `<a href="mailto:${email}" style="color:#00768b;text-decoration:none;">${email}</a>`]])}
            <div style="margin:12px 0 0;padding:16px 18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;line-height:22px;color:#0f172a;white-space:pre-wrap;">${escapedMsg}</div>
          `,
          ctaText: "Ver en el panel",
          ctaUrl: `${APP_URL}/admin/reports`,
          appUrl: APP_URL,
        }),
      });
    }
  } catch (notifyErr) {
    console.warn("submit-contact admin notify failed (non-blocking)", notifyErr);
  }

  return json({ ok: true, id: (inserted as any)?.id });
});
