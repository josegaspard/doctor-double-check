import { Resend } from "npm:resend@2.0.0";

import { requireAdminOrCron, AuthError, corsHeaders } from "../_shared/auth-guards.ts";
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface PurchaseEmailRequest {
  email: string;
  name: string;
  productName: string;
  amount: number;
  currency?: string;
  orderId?: string;
  shippingCity?: string;
  type?: 'purchase' | 'shipped' | 'delivered';
  trackingNumber?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // SECURITY (2026-05-11 audit): admin JWT or x-cron-secret. Previously open Resend relay.
  try { await requireAdminOrCron(req); } catch (__e) {
    if (__e instanceof AuthError) return __e.toResponse();
    return new Response(JSON.stringify({ error: 'auth failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const appUrl = "https://cirugiaesteticauribe.com";
    const { email, name, productName, amount, currency = 'MXN', orderId, shippingCity, type = 'purchase', trackingNumber }: PurchaseEmailRequest = await req.json();

    const formattedAmount = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency,
    }).format(amount);

    let subject = '';
    let headerBg = '';
    let headerIcon = '';
    let headerTitle = '';
    let bodyContent = '';

    if (type === 'shipped') {
      subject = `Tu pedido ha sido enviado - ${productName} | Medical Masters`;
      headerBg = 'linear-gradient(135deg, #8b5cf6, #7c3aed)';
      headerIcon = '📦';
      headerTitle = '¡Tu Pedido fue Enviado!';
      bodyContent = `
        <p style="color: #64748b; font-size: 16px;">Tu pedido está en camino.</p>
        ${trackingNumber ? `
        <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <h3 style="margin: 0 0 8px; color: #1e293b; font-size: 14px;">Número de rastreo</h3>
          <p style="margin: 0; font-size: 18px; font-weight: 700; color: #8b5cf6; font-family: monospace;">${trackingNumber}</p>
        </div>` : ''}
      `;
    } else if (type === 'delivered') {
      subject = `Tu pedido ha sido entregado - ${productName} | Medical Masters`;
      headerBg = 'linear-gradient(135deg, #10b981, #059669)';
      headerIcon = '🎉';
      headerTitle = '¡Pedido Entregado!';
      bodyContent = `<p style="color: #64748b; font-size: 16px;">Tu pedido ha sido entregado exitosamente.</p>`;
    } else {
      subject = `Compra exitosa - ${productName} | Medical Masters`;
      headerBg = 'linear-gradient(135deg, #10b981, #059669)';
      headerIcon = '✓';
      headerTitle = '¡Compra Exitosa!';
      bodyContent = `
        <p style="color: #64748b; font-size: 16px;">Tu compra ha sido procesada correctamente.</p>
        ${shippingCity ? `<p style="color: #64748b; font-size: 14px;">📍 Envío a: <strong>${shippingCity}</strong></p>` : ''}
      `;
    }

    const emailResponse = await resend.emails.send({
      from: "Medical Masters <no-reply@cirugiaesteticauribe.com>",
      to: [email],
      subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="background: ${headerBg}; padding: 32px; text-align: center;">
              <div style="width: 64px; height: 64px; background: white; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 32px;">${headerIcon}</span>
              </div>
              <h1 style="color: white; margin: 0; font-size: 24px;">${headerTitle}</h1>
            </div>
            <div style="padding: 32px;">
              <h2 style="color: #1e293b; margin-top: 0;">Hola, ${name}!</h2>
              ${bodyContent}
              <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 24px 0;">
                <h3 style="margin: 0 0 12px; color: #1e293b; font-size: 14px; text-transform: uppercase;">Detalle</h3>
                <div style="margin-bottom: 8px;">
                  <span style="color: #64748b;">Producto:</span>
                  <span style="color: #1e293b; font-weight: 600; float: right;">${productName}</span>
                </div>
                <div style="clear:both;">
                  <span style="color: #64748b;">Monto:</span>
                  <span style="color: #10b981; font-weight: 700; font-size: 18px; float: right;">${formattedAmount}</span>
                </div>
              </div>
              <div style="margin-top: 24px; text-align: center;">
                <a href="${appUrl}/my-orders" style="display: inline-block; background: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">
                  Ver mis pedidos
                </a>
              </div>
            </div>
            <div style="background: #f1f5f9; padding: 16px; text-align: center; color: #64748b; font-size: 12px;">
              <p style="margin: 0;">© 2026 Medical Masters. Todos los derechos reservados.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Purchase email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-purchase-email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

Deno.serve(handler);
