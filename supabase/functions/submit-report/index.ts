// Public report-issue handler.
// Mirror of submit-contact for /report-issue. Anonymous users can file bug,
// abuse and other reports without needing an account — we persist via the
// service-role client to bypass the RLS SELECT-after-insert gap on `reports`
// for anon, and best-effort email the admins.
//
// verify_jwt = false (see supabase/config.toml): public by design.

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
      const isAnon = reporterId === NIL_UUID;
      const escapedDesc = description
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>");
      const accentByType = type === "abuse" ? "danger" : type === "bug" ? "warning" : "info";
      const rows: Array<[string, string]> = [
        ["Tipo", reportTypeLabel(type)],
        ["Origen", isAnon ? "Anónimo" : "Usuario autenticado"],
      ];
      if (contactEmail) rows.push(["Contacto", `<a href="mailto:${contactEmail}" style="color:#00768b;text-decoration:none;">${contactEmail}</a>`]);
      await resend.emails.send({
        from: Deno.env.get("FROM_EMAIL") ?? "Medical Masters <noreply@medical-masters.com>",
        to: adminEmails,
        reply_to: contactEmail || undefined,
        subject: `Reporte (${reportTypeLabel(type)}): ${subject}`,
        html: renderEmail({
          preheader: `${reportTypeLabel(type)}: ${subject}`,
          accent: accentByType,
          eyebrow: `Nuevo reporte · ${reportTypeLabel(type)}`,
          title: subject,
          subtitle: isAnon ? "Reporte anónimo desde el sitio público." : "Reporte enviado por un usuario autenticado.",
          bodyHtml: `
            ${detailTable(rows)}
            <div style="margin:12px 0 0;padding:16px 18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;line-height:22px;color:#0f172a;white-space:pre-wrap;">${escapedDesc}</div>
            ${attachmentUrls.length > 0 ? `
              <p style="margin:18px 0 8px;font-size:13px;font-weight:600;color:#475569;">Adjuntos (${attachmentUrls.length})</p>
              <ul style="margin:0;padding-left:20px;font-size:14px;line-height:22px;">${attachmentUrls.map((u) => `<li><a href="${u}" style="color:#00768b;word-break:break-all;">${u}</a></li>`).join("")}</ul>
            ` : ""}
          `,
          ctaText: "Ver en el panel",
          ctaUrl: `${APP_URL}/admin/reports`,
          appUrl: APP_URL,
        }),
      });
    }
  } catch (notifyErr) {
    console.warn("submit-report admin notify failed (non-blocking)", notifyErr);
  }

  return json({ ok: true, id: (inserted as any)?.id });
});
