import { Resend } from "npm:resend@2.0.0";

import { requireAdminOrCron, AuthError, corsHeaders } from "../_shared/auth-guards.ts";
import { renderEmail, detailTable, bigAmount } from "../_shared/email-template.ts";

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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try { await requireAdminOrCron(req); } catch (__e) {
    if (__e instanceof AuthError) return __e.toResponse();
    return new Response(JSON.stringify({ error: 'auth failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const appUrl = "https://medical-masters.com";
    const { email, name, productName, amount, currency = 'MXN', orderId, shippingCity, type = 'purchase', trackingNumber }: PurchaseEmailRequest = await req.json();

    const formattedAmount = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency,
    }).format(amount);

    let subject = "";
    let eyebrow = "";
    let title = "";
    let subtitle = "";
    const rows: Array<[string, string]> = [["Producto", productName]];
    if (orderId) rows.push(["Pedido", `#${orderId}`]);
    if (shippingCity) rows.push(["Envío a", shippingCity]);

    if (type === 'shipped') {
      subject = `Tu pedido fue enviado: ${productName}`;
      eyebrow = "Pedido enviado";
      title = "Tu pedido está en camino";
      subtitle = "Te avisamos cuando esté entregado.";
      if (trackingNumber) rows.push(["Guía", `<span style="font-family:ui-monospace,Menlo,Consolas,monospace;">${trackingNumber}</span>`]);
    } else if (type === 'delivered') {
      subject = `Pedido entregado: ${productName}`;
      eyebrow = "Entregado";
      title = "Tu pedido fue entregado";
      subtitle = "Gracias por tu compra en Medical Masters.";
    } else {
      subject = `Compra exitosa: ${productName}`;
      eyebrow = "Compra exitosa";
      title = "Recibimos tu pago";
      subtitle = "Tu compra se procesó correctamente.";
    }

    const accent = type === 'shipped' ? 'info' : 'success';

    const html = renderEmail({
      preheader: `${title} — ${formattedAmount}`,
      accent,
      eyebrow,
      title,
      subtitle,
      greeting: `Hola, ${name}`,
      bodyHtml: `
        ${bigAmount(formattedAmount, "")}
        ${detailTable(rows)}
      `,
      ctaText: "Ver mis pedidos",
      ctaUrl: `${appUrl}/my-orders`,
      appUrl,
    });

    const emailResponse = await resend.emails.send({
      from: Deno.env.get("FROM_EMAIL") ?? "Medical Masters <no-reply@notify.medical-masters.com>",
      to: [email],
      subject,
      html,
    });

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
