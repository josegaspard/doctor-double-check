import { createClient } from "npm:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");



const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VerificationEmailRequest {
  user_id: string;
  status: "pending" | "in_progress" | "verified" | "failed" | "expired";
  user_email?: string;
  user_name?: string;
}

const getEmailContent = (status: string, name: string) => {
  const statusMessages: Record<string, { subject: string; title: string; message: string }> = {
    pending: {
      subject: "Verificación de identidad recibida",
      title: "¡Hemos recibido tu documentación!",
      message: "Tu solicitud de verificación de identidad ha sido recibida y está siendo procesada. Te notificaremos cuando tengamos una actualización.",
    },
    in_progress: {
      subject: "Verificación de identidad en proceso",
      title: "Tu verificación está siendo revisada",
      message: "Nuestro equipo está revisando tu documentación. Este proceso puede tomar entre 24 y 48 horas.",
    },
    verified: {
      subject: "¡Identidad verificada exitosamente!",
      title: "¡Felicidades! Tu identidad ha sido verificada",
      message: "Tu cuenta ahora está verificada. Ya puedes acceder a todas las funcionalidades de la plataforma.",
    },
    failed: {
      subject: "Verificación de identidad rechazada",
      title: "No pudimos verificar tu identidad",
      message: "Lamentablemente, no pudimos verificar tu identidad con la documentación proporcionada. Por favor, intenta nuevamente asegurándote de que las imágenes sean claras y legibles.",
    },
    expired: {
      subject: "Verificación de identidad expirada",
      title: "Tu verificación ha expirado",
      message: "Tu verificación de identidad ha expirado. Por favor, inicia el proceso nuevamente para mantener tu cuenta verificada.",
    },
  };

  const content = statusMessages[status] || statusMessages.pending;

  return {
    subject: content.subject,
    html: `
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
            <h2 style="color: #1e293b; margin-top: 0;">${content.title}</h2>
            <p style="color: #475569;">Hola ${name},</p>
            <p style="color: #475569;">${content.message}</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
            <p style="color: #94a3b8; font-size: 14px; margin-bottom: 0;">
              Este es un correo automático, por favor no respondas a este mensaje.
            </p>
          </div>
        </body>
      </html>
    `,
  };
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, status, user_email, user_name }: VerificationEmailRequest = await req.json();

    let email = user_email;
    let name = user_name || "Usuario";

    // If email not provided, fetch from database
    if (!email) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("email, name")
        .eq("id", user_id)
        .single();

      if (error || !profile?.email) {
        console.error("Error fetching user profile:", error);
        return new Response(
          JSON.stringify({ error: "Could not find user email" }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      email = profile.email;
      name = profile.name || "Usuario";
    }

    const { subject, html } = getEmailContent(status, name);

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Medical Masters <no-reply@cirugiaesteticauribe.com>",
        to: [email],
        subject,
        html,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      throw new Error(`Failed to send email: ${errorData}`);
    }

    const responseData = await emailResponse.json();

    console.log("Verification email sent successfully:", responseData);

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-verification-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

Deno.serve(handler);
