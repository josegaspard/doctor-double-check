import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-REFUND-EMAIL] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY not set");

    const { user_email, user_name, amount, refund_method, estimated_date } = await req.json();

    if (!user_email || !amount || !refund_method) {
      throw new Error("user_email, amount, and refund_method are required");
    }

    logStep("Sending refund email", { user_email, refund_method, amount });

    const isStripe = refund_method === 'stripe';
    const isBankTransfer = refund_method === 'bank_transfer';
    const isAwaitingBank = refund_method === 'awaiting_bank_details';

    const subject = isStripe
      ? `✅ Reembolso procesado - $${amount.toLocaleString()} MXN`
      : isBankTransfer
        ? `🏦 Reembolso en proceso - $${amount.toLocaleString()} MXN`
        : isAwaitingBank
          ? `📋 Registra tu cuenta bancaria para recibir tu reembolso`
          : `💰 Reembolso acreditado a tu billetera`;

    let bodyContent = '';

    if (isStripe) {
      bodyContent = `
        <p>Hola ${user_name || 'usuario'},</p>
        <p>Tu reembolso por <strong>$${amount.toLocaleString()} MXN</strong> ha sido procesado exitosamente a través de Stripe.</p>
        <p>El monto será reflejado en tu tarjeta/cuenta en un plazo de <strong>5-10 días hábiles</strong>, dependiendo de tu banco.</p>
        <div style="background:#e8f5e9;padding:16px;border-radius:8px;margin:16px 0;">
          <p style="margin:0;color:#2e7d32;font-weight:600;">✅ Reembolso completado</p>
          <p style="margin:4px 0 0;color:#2e7d32;">Monto: $${amount.toLocaleString()} MXN</p>
        </div>
      `;
    } else if (isBankTransfer) {
      bodyContent = `
        <p>Hola ${user_name || 'usuario'},</p>
        <p>Tu reembolso por <strong>$${amount.toLocaleString()} MXN</strong> ha sido aprobado y se procesará por transferencia bancaria.</p>
        <div style="background:#fff3e0;padding:16px;border-radius:8px;margin:16px 0;">
          <p style="margin:0;color:#e65100;font-weight:600;">🏦 Transferencia bancaria en proceso</p>
          <p style="margin:4px 0 0;color:#e65100;">Monto: $${amount.toLocaleString()} MXN</p>
          ${estimated_date ? `<p style="margin:4px 0 0;color:#e65100;">Fecha estimada: ${estimated_date}</p>` : ''}
          <p style="margin:4px 0 0;color:#e65100;">Plazo: Hasta 15 días hábiles</p>
        </div>
        <p>Recibirás una notificación cuando la transferencia haya sido completada.</p>
      `;
    } else if (isAwaitingBank) {
      bodyContent = `
        <p>Hola ${user_name || 'usuario'},</p>
        <p>Tu solicitud de reembolso por <strong>$${amount.toLocaleString()} MXN</strong> ha sido aprobada.</p>
        <p>Para procesar tu reembolso, necesitamos que registres tu cuenta bancaria (CLABE) en la plataforma.</p>
        <div style="background:#e3f2fd;padding:16px;border-radius:8px;margin:16px 0;">
          <p style="margin:0;color:#1565c0;font-weight:600;">📋 Pasos a seguir:</p>
          <ol style="margin:8px 0 0;color:#1565c0;padding-left:20px;">
            <li>Ingresa a tu billetera en Medical Masters</li>
            <li>Registra tu cuenta bancaria (CLABE de 18 dígitos)</li>
            <li>Una vez registrada, procesaremos tu reembolso en un plazo de 15 días hábiles</li>
          </ol>
        </div>
      `;
    } else {
      bodyContent = `
        <p>Hola ${user_name || 'usuario'},</p>
        <p>Tu reembolso por <strong>$${amount.toLocaleString()} MXN</strong> ha sido acreditado a tu billetera de Medical Masters.</p>
        <div style="background:#e8f5e9;padding:16px;border-radius:8px;margin:16px 0;">
          <p style="margin:0;color:#2e7d32;font-weight:600;">💰 Saldo acreditado</p>
          <p style="margin:4px 0 0;color:#2e7d32;">Monto: $${amount.toLocaleString()} MXN</p>
        </div>
        <p>Puedes usar tu saldo para consultas, contenido y más servicios en la plataforma.</p>
      `;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <body style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="color:#163a83;font-size:24px;margin:0;">Medical Masters</h1>
          <p style="color:#666;font-size:14px;margin:4px 0 0;">Plataforma Médica</p>
        </div>
        ${bodyContent}
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
        <p style="color:#999;font-size:12px;text-align:center;">
          Este correo fue enviado automáticamente por Medical Masters.<br/>
          Si tienes dudas, contacta a nuestro equipo de soporte.
        </p>
      </body>
      </html>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: "Medical Masters <onboarding@resend.dev>",
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

    logStep("Email sent successfully", { user_email, refund_method });

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
