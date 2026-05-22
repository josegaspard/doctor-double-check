// Public report-issue handler.
// Mirror of submit-contact for /report-issue. Anonymous users can file bug,
// abuse and other reports without needing an account — we persist via the
// service-role client to bypass the RLS SELECT-after-insert gap on `reports`
// for anon, and best-effort email the admins.
//
// verify_jwt = false (see supabase/config.toml): public by design.

import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const APP_URL = "https://medical-masters.com";
const NIL_UUID = "00000000-0000-0000-0000-000000000000";
const ALLOWED_TYPES = new Set(["bug", "abuse", "other"]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const clean = (s: unknown, max: number) =>
  String(s ?? "").replace(/[<>]/g, "").trim().slice(0, max);

const reportTypeLabel = (t: string) =>
  t === "bug" ? "Bug" : t === "abuse" ? "Abuso" : "Otro";

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let payload: {
    type?: string;
    subject?: string;
    description?: string;
    contactEmail?: string;
    reporterId?: string | null;
    attachmentUrls?: string[];
  };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const type = clean(payload.type, 20).toLowerCase();
  const subject = clean(payload.subject, 150);
  const description = clean(payload.description, 2000);
  const contactEmail = clean(payload.contactEmail, 255);
  const attachmentUrls = Array.isArray(payload.attachmentUrls)
    ? payload.attachmentUrls.filter((u) => typeof u === "string").slice(0, 5)
    : [];

  if (!ALLOWED_TYPES.has(type)) {
    return json({ error: "Tipo de reporte no válido." }, 400);
  }
  if (subject.length < 5) {
    return json({ error: "El asunto es muy corto (mínimo 5 caracteres)." }, 400);
  }
  if (description.length < 20) {
    return json({ error: "La descripción es muy corta (mínimo 20 caracteres)." }, 400);
  }
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return json({ error: "Correo electrónico no válido." }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, serviceKey);

  // Trust reporterId only if it actually exists in auth.users; otherwise anon.
  let reporterId = NIL_UUID;
  if (payload.reporterId && typeof payload.reporterId === "string" && payload.reporterId !== NIL_UUID) {
    const { data: u } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", payload.reporterId)
      .maybeSingle();
    if (u?.id) reporterId = payload.reporterId;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("reports")
    .insert({
      reporter_id: reporterId,
      content_type: "platform_report",
      content_id: null,
      reason: type,
      subject,
      description,
      contact_email: contactEmail || null,
      attachment_urls: attachmentUrls.length > 0 ? attachmentUrls : null,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("submit-report insert failed", insertError);
    return json({ error: "No se pudo registrar el reporte. Intenta de nuevo." }, 500);
  }

  // Best-effort admin email.
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
      const isAnon = reporterId === NIL_UUID;
      await resend.emails.send({
        from: Deno.env.get("FROM_EMAIL") ?? "Medical Masters <noreply@medical-masters.com>",
        to: adminEmails,
        reply_to: contactEmail || undefined,
        subject: `🚨 Nuevo reporte (${reportTypeLabel(type)}): ${subject}`,
        html: `
          <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b;">
            <div style="background:linear-gradient(135deg,#163a83,#00768b);padding:24px;text-align:center;">
              <img src="${APP_URL}/email-logo-white.png" width="170" alt="Medical Masters" />
            </div>
            <div style="padding:28px 24px;">
              <h1 style="font-size:20px;color:#163a83;margin:0 0 16px;">Nuevo reporte (${reportTypeLabel(type)})</h1>
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;">
                <p style="margin:4px 0;"><strong>Tipo:</strong> ${reportTypeLabel(type)}</p>
                <p style="margin:4px 0;"><strong>Asunto:</strong> ${subject}</p>
                <p style="margin:4px 0;"><strong>Origen:</strong> ${isAnon ? "Anónimo" : "Usuario autenticado"}</p>
                ${contactEmail ? `<p style="margin:4px 0;"><strong>Correo de contacto:</strong> ${contactEmail}</p>` : ""}
                <p style="margin:12px 0 4px;"><strong>Descripción:</strong></p>
                <p style="margin:0;background:#fff;padding:12px;border-radius:6px;border:1px solid #e2e8f0;white-space:pre-wrap;">${description}</p>
                ${attachmentUrls.length > 0 ? `<p style="margin:12px 0 4px;"><strong>Adjuntos (${attachmentUrls.length}):</strong></p><ul style="margin:0;padding-left:18px;">${attachmentUrls.map((u) => `<li><a href="${u}">${u}</a></li>`).join("")}</ul>` : ""}
              </div>
              <div style="margin-top:20px;text-align:center;">
                <a href="${APP_URL}/admin/reports" style="display:inline-block;background:#163a83;color:#fff;padding:12px 24px;border-radius:10px;font-weight:600;text-decoration:none;">Ver en el panel</a>
              </div>
            </div>
          </div>`,
      });
    }
  } catch (notifyErr) {
    console.warn("submit-report admin notify failed (non-blocking)", notifyErr);
  }

  return json({ ok: true, id: (inserted as any)?.id });
});
