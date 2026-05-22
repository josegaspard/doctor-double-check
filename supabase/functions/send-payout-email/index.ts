import { Resend } from "npm:resend@2.0.0";
import { requireAdminOrCron, AuthError, corsHeaders } from "../_shared/auth-guards.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { renderEmail, detailTable, bigAmount } from "../_shared/email-template.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try { await requireAdminOrCron(req); } catch (__e) {
    if (__e instanceof AuthError) return __e.toResponse();
    return new Response(JSON.stringify({ error: 'auth failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const appUrl = "https://medical-masters.com";
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
    const methodLabel = method === 'stripe' ? 'Stripe Connect' : 'Transferencia bancaria';

    // Adjuntar comprobante si existe
    const attachments: any[] = [];
    if (receipt_url) {
      try {
        const supabaseAdmin = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
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

    const rows: Array<[string, string]> = [["Método", methodLabel]];
    if (reference) rows.push(["Referencia", `<span style="font-family:ui-monospace,Menlo,Consolas,monospace;">${reference}</span>`]);
    if (notes) rows.push(["Notas", notes]);

    const html = renderEmail({
      preheader: `Pago procesado a tu favor: ${formattedAmount}`,
      accent: "success",
      eyebrow: "Pago procesado",
      title: "Recibiste un pago",
      subtitle: "Te informamos que se procesó un pago de honorarios a tu favor.",
      greeting: `Hola, ${doctor_name || 'Doctor'}`,
      bodyHtml: `
        ${bigAmount(formattedAmount, "")}
        ${detailTable(rows)}
        ${receipt_url && attachments.length > 0 ? `<p style="margin:8px 0 0;color:#475569;font-size:14px;">Adjunto encontrarás el comprobante de pago en PDF.</p>` : ''}
      `,
      ctaText: "Ver mis pagos",
      ctaUrl: `${appUrl}/doctor/payouts`,
      appUrl,
    });

    const emailResponse = await resend.emails.send({
      from: Deno.env.get("FROM_EMAIL") ?? "Medical Masters <no-reply@medical-masters.com>",
      to: [doctor_email],
      subject: `Pago procesado — ${formattedAmount}`,
      attachments: attachments.length > 0 ? attachments : undefined,
      html,
    });

    return new Response(JSON.stringify({ success: true, id: (emailResponse as any).id }), {
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
