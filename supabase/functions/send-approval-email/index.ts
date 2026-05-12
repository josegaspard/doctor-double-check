import { Resend } from "npm:resend@2.0.0";

import { requireAdminOrCron, AuthError, corsHeaders } from "../_shared/auth-guards.ts";
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface ApprovalEmailRequest {
  email: string;
  name: string;
  role: 'doctor' | 'resident';
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
    const { email, name, role }: ApprovalEmailRequest = await req.json();

    const roleContent = {
      doctor: {
        subject: "🎉 ¡Tu cuenta ha sido aprobada! - Medical Masters",
        greeting: "¡Felicidades! Tu cuenta de médico ha sido aprobada",
        features: `
          <ul style="color: #334155; padding-left: 20px;">
            <li>📺 Crear transmisiones en vivo para tus seguidores</li>
            <li>💬 Atender consultas médicas por chat y videollamada</li>
            <li>📄 Emitir recetas médicas digitales con tu firma</li>
            <li>📚 Publicar contenido educativo premium</li>
            <li>💰 Recibir pagos por tus servicios profesionales</li>
            <li>📊 Acceder a tu panel de analíticas y métricas</li>
          </ul>
        `,
        cta: "Ir a mi panel de doctor",
        ctaUrl: `${appUrl}/doctor`,
      },
      resident: {
        subject: "🎉 ¡Tu cuenta ha sido aprobada! - Medical Masters",
        greeting: "¡Felicidades! Tu cuenta de residente ha sido aprobada",
        features: `
          <ul style="color: #334155; padding-left: 20px;">
            <li>📺 Ver transmisiones en vivo de médicos especialistas</li>
            <li>📚 Acceder a contenido educativo con 50% de descuento</li>
            <li>🎓 Participar en sesiones clínicas</li>
            <li>💬 Comunicarte con otros profesionales de la salud</li>
            <li>📖 Acceder a grabaciones de procedimientos</li>
          </ul>
        `,
        cta: "Explorar la plataforma",
        ctaUrl: `${appUrl}/lives`,
      },
    };

    const content = roleContent[role];

    const emailResponse = await resend.emails.send({
      from: Deno.env.get("FROM_EMAIL") ?? "Medical Masters <no-reply@medical-masters.com>",
      to: [email],
      subject: content.subject,
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
                <span style="font-size: 32px;">✅</span>
              </div>
              <h1 style="color: white; margin: 0; font-size: 24px;">¡Cuenta Aprobada!</h1>
            </div>
            <div style="padding: 32px;">
              <h2 style="color: #1e293b; margin-top: 0;">Hola, ${name}!</h2>
              <p style="color: #64748b; font-size: 16px;">${content.greeting}</p>
              <p style="color: #64748b; font-size: 16px;">Nuestro equipo ha verificado tu documentación y ahora tienes acceso completo a la plataforma.</p>
              
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 24px 0;">
                <h3 style="color: #166534; margin: 0 0 12px; font-size: 16px;">Ahora puedes:</h3>
                ${content.features}
              </div>

              <div style="margin-top: 24px; text-align: center;">
                <a href="${content.ctaUrl}" style="display: inline-block; background: #10b981; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  ${content.cta}
                </a>
              </div>

              <p style="color: #94a3b8; font-size: 13px; margin-top: 24px; text-align: center;">
                Si tienes alguna duda, no dudes en contactarnos desde la plataforma.
              </p>
            </div>
            <div style="background: #f1f5f9; padding: 16px; text-align: center; color: #64748b; font-size: 12px;">
              <p style="margin: 0;">© 2026 Medical Masters. Todos los derechos reservados.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Approval email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-approval-email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

Deno.serve(handler);
