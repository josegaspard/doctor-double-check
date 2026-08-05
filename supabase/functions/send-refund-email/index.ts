import { createClient } from "npm:@supabase/supabase-js@2";

import { requireAdminOrCron, AuthError, corsHeaders } from "../_shared/auth-guards.ts";
import { renderEmail, detailTable, bigAmount, infoCard, EmailAccent } from "../_shared/email-template.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-REFUND-EMAIL] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try { await requireAdminOrCron(req); } catch (__e) {
    if (__e instanceof AuthError) return __e.toResponse();
    return new Response(JSON.stringify({ error: 'auth failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY not set");
    const appUrl = "https://medical-masters.com";

    const { user_email, user_name, amount, refund_method, estimated_date } = await req.json();
    if (!user_email || !amount || !refund_method) {
      throw new Error("user_email, amount, and refund_method are required");
    }

    const isStripe        = refund_method === 'stripe';
    const isBankTransfer  = refund_method === 'bank_transfer';
    const isAwaitingBank  = refund_method === 'awaiting_bank_details';
    const fmt = `$${amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN`;

    let subject = "";
    let eyebrow = "";
    let title = "";
    let subtitle = "";
    let accent: EmailAccent = "success";
    let bodyHtml = "";
    let ctaText = "Ver mi billetera";
    let ctaUrl = `${appUrl}/wallet`;

    if (isStripe) {
      subject = `Reembolso procesado — ${fmt}`;
      eyebrow = "Reembolso procesado";
      title = "Tu reembolso fue procesado";
      subtitle = "El monto se reflejará en tu tarjeta en 5–10 días hábiles.";
      accent = "success";
      bodyHtml = `
        ${bigAmount(fmt, "")}
        ${detailTable([["Método", "Stripe (tarjeta original)"], ["Plazo estimado", "5–10 días hábiles"]])}
      `;
    } else if (isBankTransfer) {
      subject = `Reembolso en proceso — ${fmt}`;
      eyebrow = "Transferencia en proceso";
      title = "Tu reembolso está en camino";
      subtitle = "Se enviará por transferencia bancaria. Te avisamos al completarse.";
      accent = "info";
      const rows: Array<[string, string]> = [["Método", "Transferencia bancaria"], ["Plazo", "Hasta 15 días hábiles"]];
      if (estimated_date) rows.push(["Fecha estimada", estimated_date]);
      bodyHtml = `${bigAmount(fmt, "")}${detailTable(rows)}`;
    } else if (isAwaitingBank) {
      subject = "Acción requerida: registra tu cuenta bancaria";
      eyebrow = "Requiere acción";
      title = "Necesitamos tus datos bancarios";
      subtitle = "Tu reembolso fue aprobado. Falta registrar tu CLABE para procesarlo.";
      accent = "warning";
      ctaText = "Registrar cuenta bancaria";
      ctaUrl = `${appUrl}/wallet`;
      bodyHtml = `
        ${bigAmount(fmt, "")}
        ${infoCard({
          title: "Pasos a seguir",
          accent: "info",
          html: `
            <ol style="margin:6px 0 0;padding-left:22px;">
              <li>Ingresa a tu billetera en Medical Masters</li>
              <li>Registra tu cuenta bancaria (CLABE de 18 dígitos)</li>
              <li>Procesaremos tu reembolso en hasta 15 días hábiles</li>
            </ol>`,
        })}
      `;
    } else {
      subject = `Saldo acreditado a tu billetera — ${fmt}`;
      eyebrow = "Saldo acreditado";
      title = "Recibiste tu reembolso";
      subtitle = "El monto ya está disponible en tu billetera Medical Masters.";
      accent = "success";
      bodyHtml = `
        ${bigAmount(fmt, "")}
        <p style="margin:8px 0 0;">Puedes usar tu saldo para consultas, contenido premium y demás servicios de la plataforma.</p>
      `;
    }

    const html = renderEmail({
      preheader: `${title} — ${fmt}`,
      accent,
      eyebrow,
      title,
      subtitle,
      greeting: `Hola, ${user_name || 'usuario'}`,
      bodyHtml,
      ctaText,
      ctaUrl,
      appUrl,
    });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: Deno.env.get("FROM_EMAIL") ?? "Medical Masters <no-reply@notify.medical-masters.com>",
        to: [user_email],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      logStep("Resend error", { status: res.status, body: err });
      throw new Error(`Email send failed: ${err}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    logStep("ERROR", { message: error.message });
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
