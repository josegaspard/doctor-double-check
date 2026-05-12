import { Resend } from "npm:resend@2.0.0";
import { requireAdminOrCron, AuthError, corsHeaders } from "../_shared/auth-guards.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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
    const { doctor_email, doctor_name, amount, method, reference, notes, receipt_url } = await req.json();

    if (!doctor_email) {
      return new Response(JSON.stringify({ error: "Missing doctor_email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formattedAmount = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);

    const methodLabel = method === 'stripe' ? 'Stripe Connect' : 'Transferencia Bancaria';

    // Build attachments if receipt_url exists
    const attachments: any[] = [];
    if (receipt_url) {
      try {
        const supabaseAdmin = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        // Generate a signed URL for the receipt
        const { data: signedData } = await supabaseAdmin.storage
          .from('doctor-invoices')
          .createSignedUrl(receipt_url, 3600);

        if (signedData?.signedUrl) {
          const fileResponse = await fetch(signedData.signedUrl);
          if (fileResponse.ok) {
            const arrayBuffer = await fileResponse.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            const base64 = btoa(String.fromCharCode(...uint8Array));
            const contentType = fileResponse.headers.get('content-type') || 'application/pdf';
            const ext = contentType.includes('pdf') ? 'pdf' : contentType.includes('png') ? 'png' : 'jpg';

            attachments.push({
              filename: `comprobante_pago.${ext}`,
              content: base64,
              content_type: contentType,
            });
          }
        }
      } catch (e) {
        console.error("Error attaching receipt:", e);
      }
    }

    const emailResponse = await resend.emails.send({
      from: Deno.env.get("FROM_EMAIL") ?? "Medical Masters <no-reply@medical-masters.com>",
      to: [doctor_email],
      subject: `💰 Pago procesado - ${formattedAmount} | Medical Masters`,
      attachments: attachments.length > 0 ? attachments : undefined,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 32px; text-align: center;">
              <div style="width: 64px; height: 64px; background: white; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 32px;">💰</span>
              </div>
              <h1 style="color: white; margin: 0; font-size: 24px;">¡Pago Procesado!</h1>
            </div>
            <div style="padding: 32px;">
              <p style="color: #334155; font-size: 16px;">Hola <strong>${doctor_name || 'Doctor'}</strong>,</p>
              <p style="color: #334155; font-size: 16px;">Te informamos que se ha procesado un pago a tu favor:</p>
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <div style="text-align: center;">
                  <p style="color: #15803d; font-size: 32px; font-weight: bold; margin: 0;">${formattedAmount}</p>
                  <p style="color: #166534; font-size: 14px; margin: 8px 0 0;">Método: ${methodLabel}</p>
                  ${reference ? `<p style="color: #64748b; font-size: 13px; margin: 4px 0 0;">Referencia: ${reference}</p>` : ''}
                  ${notes ? `<p style="color: #64748b; font-size: 13px; margin: 4px 0 0;">Notas: ${notes}</p>` : ''}
                </div>
              </div>
              ${receipt_url && attachments.length > 0 ? '<p style="color: #64748b; font-size: 14px;">📎 Se adjunta el comprobante de pago.</p>' : ''}
              <p style="color: #64748b; font-size: 14px; margin-top: 24px;">Si tienes alguna duda, contáctanos a través de la plataforma.</p>
            </div>
            <div style="background: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} Medical Masters. Todos los derechos reservados.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    return new Response(JSON.stringify({ success: true, id: emailResponse.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error sending payout email:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

Deno.serve(handler);
