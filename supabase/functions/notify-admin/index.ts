// Admin notification dispatcher
// Sends an email to every user with role='admin' on key events:
//   - doctor_signup: a new doctor completed onboarding and is awaiting verification
//   - resident_signup: a new resident completed onboarding and is awaiting verification
//   - new_report: a user filed an abuse/bug report
//   - new_purchase: a marketplace order was paid
//
// Called from authenticated client flows (Onboarding completion, ReportIssue submit) and
// from the stripe-webhook server-side. JWT is required to prevent open relays — server-side
// callers pass the service-role key. We validate the caller can only file reports/onboarding
// records for themselves (other types accept service-role-only).

import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth-guards.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "Medical Masters <noreply@medical-masters.com>";
const APP_URL = "https://medical-masters.com";

type NotifyType = "doctor_signup" | "resident_signup" | "new_report" | "new_purchase";

interface DoctorSignupPayload {
  userName: string;
  userEmail: string;
  specialty: string;
  license: string;
}
interface ResidentSignupPayload {
  userName: string;
  userEmail: string;
  institution: string;
  specialty: string;
  year: number;
}
interface NewReportPayload {
  reporterEmail: string;
  reporterName: string;
  reportType: string;
  contentType?: string;
  description: string;
  reportId: string;
}
interface NewPurchasePayload {
  buyerEmail: string;
  buyerName: string;
  productName: string;
  amount: number;
  currency: string;
  orderId: string;
}

function buildEmail(type: NotifyType, data: any): { subject: string; html: string } {
  const header = `
    <div style="background: linear-gradient(135deg, #163a83, #00768b); padding: 32px 24px; text-align: center;">
      <img src="${APP_URL}/email-logo-white.png" width="180" alt="Medical Masters" style="margin: 0 auto;" />
    </div>
  `;
  const wrapBody = (title: string, body: string, ctaUrl: string, ctaLabel: string) => `
    <!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/></head>
    <body style="margin:0;background:#ffffff;font-family:Inter,Arial,sans-serif;">
      <div style="max-width:600px;margin:20px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);">
        ${header}
        <div style="padding:32px 24px;color:#1e293b;">
          <h1 style="margin:0 0 16px;font-size:24px;color:#163a83;">${title}</h1>
          ${body}
          <div style="margin-top:24px;text-align:center;">
            <a href="${ctaUrl}" style="display:inline-block;background:#163a83;color:#fff;padding:14px 28px;border-radius:12px;font-weight:600;text-decoration:none;">${ctaLabel}</a>
          </div>
          <hr style="margin:32px 0;border:0;border-top:1px solid #e2e8f0;" />
          <p style="color:#94a3b8;font-size:12px;text-align:center;margin:0;">Notificación automática de Medical Masters · ${new Date().toLocaleDateString("es-MX")}</p>
        </div>
      </div>
    </body></html>
  `;

  if (type === "doctor_signup") {
    const p = data as DoctorSignupPayload;
    return {
      subject: `🩺 Nuevo médico pendiente de verificación: ${p.userName}`,
      html: wrapBody(
        "Nuevo médico registrado",
        `
          <p style="font-size:16px;line-height:1.6;">Un nuevo profesional completó su onboarding y está pendiente de verificación.</p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;">
            <p style="margin:4px 0;"><strong>Nombre:</strong> ${p.userName}</p>
            <p style="margin:4px 0;"><strong>Correo:</strong> ${p.userEmail}</p>
            <p style="margin:4px 0;"><strong>Especialidad:</strong> ${p.specialty || "—"}</p>
            <p style="margin:4px 0;"><strong>Cédula profesional:</strong> ${p.license || "(pendiente)"}</p>
          </div>
        `,
        `${APP_URL}/admin/doctors`,
        "Revisar en panel admin",
      ),
    };
  }
  if (type === "resident_signup") {
    const p = data as ResidentSignupPayload;
    return {
      subject: `🎓 Nuevo residente pendiente de verificación: ${p.userName}`,
      html: wrapBody(
        "Nuevo residente registrado",
        `
          <p style="font-size:16px;line-height:1.6;">Un residente completó su onboarding y está pendiente de verificación.</p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;">
            <p style="margin:4px 0;"><strong>Nombre:</strong> ${p.userName}</p>
            <p style="margin:4px 0;"><strong>Correo:</strong> ${p.userEmail}</p>
            <p style="margin:4px 0;"><strong>Institución:</strong> ${p.institution || "—"}</p>
            <p style="margin:4px 0;"><strong>Especialidad:</strong> ${p.specialty || "—"}</p>
            <p style="margin:4px 0;"><strong>Año de residencia:</strong> ${p.year}</p>
          </div>
        `,
        `${APP_URL}/admin/residents`,
        "Revisar en panel admin",
      ),
    };
  }
  if (type === "new_report") {
    const p = data as NewReportPayload;
    return {
      subject: `🚨 Nueva denuncia (${p.reportType}) de ${p.reporterName}`,
      html: wrapBody(
        "Nueva denuncia recibida",
        `
          <p style="font-size:16px;line-height:1.6;">Un usuario reportó un problema en la plataforma.</p>
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0;">
            <p style="margin:4px 0;"><strong>Tipo:</strong> ${p.reportType}</p>
            ${p.contentType ? `<p style="margin:4px 0;"><strong>Sobre:</strong> ${p.contentType}</p>` : ""}
            <p style="margin:4px 0;"><strong>Reportado por:</strong> ${p.reporterName} (${p.reporterEmail})</p>
            <p style="margin:12px 0 4px;"><strong>Descripción:</strong></p>
            <p style="margin:0;background:#fff;padding:12px;border-radius:6px;border:1px solid #fecaca;white-space:pre-wrap;">${p.description.replace(/[<>]/g, "")}</p>
          </div>
        `,
        `${APP_URL}/admin/reports`,
        "Ver denuncia",
      ),
    };
  }
  if (type === "new_purchase") {
    const p = data as NewPurchasePayload;
    const formattedAmount = new Intl.NumberFormat("es-MX", { style: "currency", currency: p.currency || "MXN" }).format(p.amount);
    return {
      subject: `💰 Nueva venta: ${formattedAmount} – ${p.productName}`,
      html: wrapBody(
        "Nueva compra confirmada",
        `
          <p style="font-size:16px;line-height:1.6;">Se completó una compra en el marketplace.</p>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0;">
            <p style="margin:4px 0;"><strong>Producto:</strong> ${p.productName}</p>
            <p style="margin:4px 0;"><strong>Monto:</strong> ${formattedAmount}</p>
            <p style="margin:4px 0;"><strong>Comprador:</strong> ${p.buyerName} (${p.buyerEmail})</p>
            <p style="margin:4px 0;"><strong>ID de orden:</strong> <code>${p.orderId}</code></p>
          </div>
        `,
        `${APP_URL}/admin/marketplace`,
        "Ver orden",
      ),
    };
  }
  throw new Error(`Unknown notification type: ${type}`);
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { type, data } = await req.json() as { type: NotifyType; data: any };
    if (!type || !data) {
      return new Response(JSON.stringify({ error: "Missing type or data" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch admin emails via service-role client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: admins, error: adminsError } = await supabase
      .from("user_roles")
      .select("user_id, profiles:profiles(email)")
      .eq("role", "admin");

    if (adminsError) {
      console.error("admins lookup failed", adminsError);
      return new Response(JSON.stringify({ error: "admin lookup failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminEmails = (admins ?? [])
      .map((row: any) => row?.profiles?.email)
      .filter((e: any) => typeof e === "string" && e.includes("@"));

    if (adminEmails.length === 0) {
      console.warn("No admin emails found, skipping notification", { type });
      return new Response(JSON.stringify({ skipped: "no admins" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { subject, html } = buildEmail(type, data);
    const res = await resend.emails.send({
      from: FROM_EMAIL,
      to: adminEmails,
      subject,
      html,
    });

    console.log("admin notification sent", { type, recipients: adminEmails.length, id: (res as any)?.data?.id });
    return new Response(JSON.stringify({ ok: true, recipients: adminEmails.length }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("notify-admin error", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
