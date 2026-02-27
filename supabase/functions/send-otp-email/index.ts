import { createClient } from "npm:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface OtpEmailRequest {
  patientEmail: string;
  patientName: string;
  doctorName: string;
  otpCode: string;
  expiresInMinutes: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { patientEmail, patientName, doctorName, otpCode, expiresInMinutes }: OtpEmailRequest = await req.json();

    if (!patientEmail || !otpCode) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Medical Masters</h1>
          </div>
          <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none;">
            <h2 style="color: #1e293b; margin-top: 0;">🔐 Código de acceso a tu expediente</h2>
            <p style="color: #475569;">Hola ${patientName},</p>
            <p style="color: #475569;">
              <strong>${doctorName}</strong> está solicitando acceso a tu expediente médico. 
              Si estás de acuerdo, comparte el siguiente código:
            </p>
            <div style="background: #0ea5e9; color: white; font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 20px; border-radius: 8px; margin: 20px 0;">
              ${otpCode}
            </div>
            <p style="color: #ef4444; font-weight: 600; text-align: center;">
              ⏱️ Este código expira en ${expiresInMinutes} minutos
            </p>
            <p style="color: #475569; font-size: 14px;">
              Si no reconoces esta solicitud, ignora este correo. No compartas este código con nadie más.
            </p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
            <p style="color: #94a3b8; font-size: 14px; margin-bottom: 0;">
              Este es un correo automático, por favor no respondas a este mensaje.
            </p>
          </div>
        </body>
      </html>
    `;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Medical Masters <onboarding@resend.dev>",
        to: [patientEmail],
        subject: `🔐 Código de acceso a tu expediente médico: ${otpCode}`,
        html,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      throw new Error(`Failed to send email: ${errorData}`);
    }

    const responseData = await emailResponse.json();
    console.log("OTP email sent successfully:", responseData);

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-otp-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

Deno.serve(handler);
