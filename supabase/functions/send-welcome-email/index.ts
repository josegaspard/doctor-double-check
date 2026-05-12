import { Resend } from "npm:resend@2.0.0";

import { requireAdminOrCron, AuthError, corsHeaders } from "../_shared/auth-guards.ts";
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface WelcomeEmailRequest {
  email: string;
  name: string;
  role: 'patient' | 'doctor' | 'resident';
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
    const appUrl = "https://medical-masters.com";
    const { email, name, role }: WelcomeEmailRequest = await req.json();

    const roleMessages = {
      patient: {
        subject: "¡Bienvenido a Medical Masters!",
        greeting: "Estamos felices de tenerte con nosotros",
        content: `
          <p>Ahora puedes:</p>
          <ul>
            <li>Ver transmisiones en vivo de médicos especialistas</li>
            <li>Acceder a grabaciones educativas</li>
            <li>Subir tu historial médico de forma segura</li>
            <li>Consultar con médicos verificados</li>
          </ul>
          <div style="background: #fffbeb; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="color: #92400e; font-weight: 600; margin: 0 0 8px;">💰 Configura tu método de pago</p>
            <p style="color: #92400e; margin: 0; font-size: 14px;">
              Para acceder a contenido premium, suscripciones y consultas médicas, necesitarás recargar saldo en tu wallet. 
              Ve a <strong>Wallet</strong> en la plataforma para agregar fondos de forma segura con tarjeta de crédito o débito.
            </p>
          </div>
        `,
      },
      doctor: {
        subject: "Solicitud de registro recibida - Medical Masters",
        greeting: "Tu solicitud está siendo revisada",
        content: `
          <p>Hemos recibido tu solicitud de registro como médico.</p>
          <p>Nuestro equipo está revisando tu documentación y te notificaremos cuando tu cuenta sea aprobada.</p>
          <p>El proceso de verificación toma entre 24-48 horas hábiles.</p>
        `,
      },
      resident: {
        subject: "Solicitud de registro recibida - Medical Masters",
        greeting: "Tu solicitud está siendo revisada",
        content: `
          <p>Hemos recibido tu solicitud de registro como residente médico.</p>
          <p>Nuestro equipo está revisando tu documentación y te notificaremos cuando tu cuenta sea aprobada.</p>
          <p>Recuerda que como residente tendrás acceso a descuentos especiales del 50% en contenido.</p>
        `,
      },
    };

    const message = roleMessages[role] || roleMessages.patient;

    const emailResponse = await resend.emails.send({
      from: Deno.env.get("FROM_EMAIL") ?? "Medical Masters <no-reply@medical-masters.com>",
      to: [email],
      subject: message.subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="background: linear-gradient(135deg, #0ea5e9, #6366f1); padding: 32px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Medical Masters</h1>
            </div>
            <div style="padding: 32px;">
              <h2 style="color: #1e293b; margin-top: 0;">Hola, ${name}!</h2>
              <p style="color: #64748b; font-size: 16px;">${message.greeting}</p>
              <div style="color: #334155;">
                ${message.content}
              </div>
              <div style="margin-top: 24px; text-align: center;">
                <a href="${appUrl}" style="display: inline-block; background: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">
                  Ir a la plataforma
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

    console.log("Welcome email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-welcome-email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

Deno.serve(handler);
