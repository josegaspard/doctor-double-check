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
    const { data: admins } = await supabase
      .from("user_roles")
      .select("profiles:profiles(email)")
      .eq("role", "admin");

    const adminEmails = (admins ?? [])
      .map((row: any) => row?.profiles?.email)
      .filter((e: any) => typeof e === "string" && e.includes("@"));

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey && adminEmails.length > 0) {
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: Deno.env.get("FROM_EMAIL") ?? "Medical Masters <noreply@medical-masters.com>",
        to: adminEmails,
        reply_to: email,
        subject: `📨 Nuevo mensaje de contacto: ${subject}`,
        html: `
          <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b;">
            <div style="background:linear-gradient(135deg,#163a83,#00768b);padding:24px;text-align:center;">
              <img src="${APP_URL}/email-logo-white.png" width="170" alt="Medical Masters" />
            </div>
            <div style="padding:28px 24px;">
              <h1 style="font-size:20px;color:#163a83;margin:0 0 16px;">Nuevo mensaje de contacto</h1>
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;">
                <p style="margin:4px 0;"><strong>Nombre:</strong> ${name}</p>
                <p style="margin:4px 0;"><strong>Correo:</strong> ${email}</p>
                <p style="margin:4px 0;"><strong>Asunto:</strong> ${subject}</p>
                <p style="margin:12px 0 4px;"><strong>Mensaje:</strong></p>
                <p style="margin:0;background:#fff;padding:12px;border-radius:6px;border:1px solid #e2e8f0;white-space:pre-wrap;">${message}</p>
              </div>
              <div style="margin-top:20px;text-align:center;">
                <a href="${APP_URL}/admin/reports" style="display:inline-block;background:#163a83;color:#fff;padding:12px 24px;border-radius:10px;font-weight:600;text-decoration:none;">Ver en el panel</a>
              </div>
            </div>
          </div>`,
      });
    }
  } catch (notifyErr) {
    console.warn("submit-contact admin notify failed (non-blocking)", notifyErr);
  }

  return json({ ok: true, id: (inserted as any)?.id });
});
