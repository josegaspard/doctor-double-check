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
import { requireUserOrService, AuthError, corsHeadersFor } from "../_shared/auth-guards.ts";
import { renderEmail, detailTable, bigAmount } from "../_shared/email-template.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "Medical Masters <noreply@notify.medical-masters.com>";
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
  if (type === "doctor_signup") {
    const p = data as DoctorSignupPayload;
    return {
      subject: `Nuevo médico pendiente: ${p.userName}`,
      html: renderEmail({
        preheader: `Nuevo médico esperando verificación: ${p.userName}`,
        accent: "info",
        eyebrow: "Nuevo médico",
        title: "Médico pendiente de verificación",
        subtitle: "Un nuevo profesional completó su onboarding.",
        bodyHtml: detailTable([
          ["Nombre", p.userName],
          ["Correo", `<a href="mailto:${p.userEmail}" style="color:#00768b;text-decoration:none;">${p.userEmail}</a>`],
          ["Especialidad", p.specialty || "—"],
          ["Cédula", p.license || "(pendiente)"],
        ]),
        ctaText: "Revisar en el panel",
        ctaUrl: `${APP_URL}/admin/doctors`,
        appUrl: APP_URL,
      }),
    };
  }
  if (type === "resident_signup") {
    const p = data as ResidentSignupPayload;
    return {
      subject: `Nuevo residente pendiente: ${p.userName}`,
      html: renderEmail({
        preheader: `Nuevo residente esperando verificación: ${p.userName}`,
        accent: "info",
        eyebrow: "Nuevo residente",
        title: "Residente pendiente de verificación",
        subtitle: "Un residente completó su onboarding.",
        bodyHtml: detailTable([
          ["Nombre", p.userName],
          ["Correo", `<a href="mailto:${p.userEmail}" style="color:#00768b;text-decoration:none;">${p.userEmail}</a>`],
          ["Institución", p.institution || "—"],
          ["Especialidad", p.specialty || "—"],
          ["Año", String(p.year)],
        ]),
        ctaText: "Revisar en el panel",
        ctaUrl: `${APP_URL}/admin/residents`,
        appUrl: APP_URL,
      }),
    };
  }
  if (type === "new_report") {
    const p = data as NewReportPayload;
    const safeDesc = (p.description || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
    return {
      subject: `Denuncia (${p.reportType}) de ${p.reporterName}`,
      html: renderEmail({
        preheader: `Denuncia (${p.reportType}) recibida`,
        accent: "danger",
        eyebrow: `Denuncia · ${p.reportType}`,
        title: "Nueva denuncia recibida",
        subtitle: "Un usuario reportó un problema en la plataforma.",
        bodyHtml: `
          ${detailTable([
            ["Tipo", p.reportType],
            ...(p.contentType ? [["Sobre", p.contentType] as [string,string]] : []),
            ["Reportado por", `${p.reporterName} <a href="mailto:${p.reporterEmail}" style="color:#00768b;text-decoration:none;">(${p.reporterEmail})</a>`],
          ])}
          <div style="margin:12px 0 0;padding:16px 18px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;font-size:14px;line-height:22px;color:#7f1d1d;white-space:pre-wrap;">${safeDesc}</div>
        `,
        ctaText: "Ver denuncia",
        ctaUrl: `${APP_URL}/admin/reports`,
        appUrl: APP_URL,
      }),
    };
  }
  if (type === "new_purchase") {
    const p = data as NewPurchasePayload;
    const formattedAmount = new Intl.NumberFormat("es-MX", { style: "currency", currency: p.currency || "MXN" }).format(p.amount);
    return {
      subject: `Nueva venta: ${formattedAmount} — ${p.productName}`,
      html: renderEmail({
        preheader: `${p.productName} — ${formattedAmount}`,
        accent: "success",
        eyebrow: "Nueva venta",
        title: "Nueva compra confirmada",
        subtitle: `Compra completada en el marketplace.`,
        bodyHtml: `
          ${bigAmount(formattedAmount, "")}
          ${detailTable([
            ["Producto", p.productName],
            ["Comprador", `${p.buyerName} <a href="mailto:${p.buyerEmail}" style="color:#00768b;text-decoration:none;">(${p.buyerEmail})</a>`],
            ["Orden", `<span style="font-family:ui-monospace,Menlo,Consolas,monospace;">${p.orderId}</span>`],
          ])}
        `,
        ctaText: "Ver orden",
        ctaUrl: `${APP_URL}/admin/marketplace`,
        appUrl: APP_URL,
      }),
    };
  }
  throw new Error(`Unknown notification type: ${type}`);
}

Deno.serve(async (req: Request): Promise<Response> => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // SECURITY 2026-05-17: caller debe ser un usuario autenticado (ReportIssue,
  // Onboarding) o el service-role (stripe-webhook server-side). Antes: open
  // relay — cualquiera podía dispararle emails a los admins arbitrariamente.
  let caller: { id: string } | null = null;
  try {
    const user = await requireUserOrService(req);
    caller = user ? { id: user.id } : null;
  } catch (e) {
    if (e instanceof AuthError) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: e.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Auth check failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { type, data } = await req.json() as { type: NotifyType; data: any };
    if (!type || !data) {
      return new Response(JSON.stringify({ error: "Missing type or data" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // `new_purchase` solo lo dispara el stripe-webhook server-side (service-role).
    // Bloquear que un usuario regular falsifique compras para spamear admins.
    if (type === "new_purchase" && caller !== null) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch admin emails via service-role client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceKey);

    // 2 pasos: no hay FK directa user_roles->profiles (el embed daba HTTP 400).
    const { data: adminRoles, error: adminsError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (adminsError) {
      console.error("admins lookup failed", adminsError);
      return new Response(JSON.stringify({ error: "admin lookup failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

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
