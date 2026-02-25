import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PurchaseEmailRequest {
  email: string;
  name: string;
  productName: string;
  amount: number;
  currency?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const appUrl = "https://cirugiaesteticauribe.com";
    const { email, name, productName, amount, currency = 'MXN' }: PurchaseEmailRequest = await req.json();

    const formattedAmount = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency,
    }).format(amount);

    const emailResponse = await resend.emails.send({
      from: "Dr Double Check <onboarding@resend.dev>",
      to: [email],
      subject: `Compra exitosa - ${productName} | Medical Masters`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 32px; text-align: center;">
              <div style="width: 64px; height: 64px; background: white; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 32px;">✓</span>
              </div>
              <h1 style="color: white; margin: 0; font-size: 24px;">¡Compra Exitosa!</h1>
            </div>
            <div style="padding: 32px;">
              <h2 style="color: #1e293b; margin-top: 0;">Hola, ${name}!</h2>
              <p style="color: #64748b; font-size: 16px;">Tu compra ha sido procesada correctamente.</p>
              
              <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 24px 0;">
                <h3 style="margin: 0 0 12px; color: #1e293b; font-size: 14px; text-transform: uppercase;">Detalle de la compra</h3>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span style="color: #64748b;">Producto:</span>
                  <span style="color: #1e293b; font-weight: 600;">${productName}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #64748b;">Monto:</span>
                  <span style="color: #10b981; font-weight: 700; font-size: 18px;">${formattedAmount}</span>
                </div>
              </div>
              
              <p style="color: #64748b; font-size: 14px;">
                Ya puedes acceder a tu contenido desde la plataforma.
              </p>
              
              <div style="margin-top: 24px; text-align: center;">
                <a href="${appUrl}/recordings" style="display: inline-block; background: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">
                  Ver mis compras
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
