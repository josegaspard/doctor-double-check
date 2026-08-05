import { Resend } from "npm:resend@2.0.0";

import { requireAdminOrCron, AuthError, corsHeaders } from "../_shared/auth-guards.ts";
import { renderEmail, infoCard } from "../_shared/email-template.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface ApprovalEmailRequest {
  email: string;
  name: string;
  role: 'doctor' | 'resident';
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try { await requireAdminOrCron(req); } catch (__e) {
    if (__e instanceof AuthError) return __e.toResponse();
    return new Response(JSON.stringify({ error: 'auth failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const appUrl = "https://medical-masters.com";
    const { email, name, role }: ApprovalEmailRequest = await req.json();

    const featuresDoctor = `
      <ul style="margin:6px 0 0;padding-left:22px;color:#0f172a;">
        <li>Crear transmisiones en vivo para tus seguidores</li>
        <li>Atender consultas por chat y videollamada</li>
        <li>Emitir recetas médicas digitales con tu firma</li>
        <li>Publicar contenido educativo premium</li>
        <li>Recibir pagos por tus servicios profesionales</li>
        <li>Acceder a tu panel de analíticas y métricas</li>
      </ul>`;
    const featuresResident = `
      <ul style="margin:6px 0 0;padding-left:22px;color:#0f172a;">
        <li>Ver transmisiones en vivo de médicos especialistas</li>
        <li>Acceder a contenido educativo con 50% de descuento</li>
        <li>Participar en sesiones clínicas</li>
        <li>Comunicarte con otros profesionales de la salud</li>
        <li>Acceder a grabaciones de procedimientos</li>
      </ul>`;

    const isDoctor = role === 'doctor';
    const subject = isDoctor
      ? "Tu cuenta de médico ha sido aprobada — Medical Masters"
      : "Tu cuenta de residente ha sido aprobada — Medical Masters";

    const html = renderEmail({
      preheader: isDoctor
        ? "Tu cuenta de médico está activa. Ya puedes empezar a usar la plataforma."
        : "Tu cuenta de residente está activa. Ya puedes empezar a usar la plataforma.",
      accent: "success",
      eyebrow: "Cuenta aprobada",
      title: isDoctor
        ? "Tu cuenta de médico está activa"
        : "Tu cuenta de residente está activa",
      subtitle: "Nuestro equipo verificó tu documentación. Ya tienes acceso completo a la plataforma.",
      greeting: `Hola, ${name}`,
      bodyHtml: `
        ${infoCard({
          title: "Ahora puedes",
          accent: "success",
          html: isDoctor ? featuresDoctor : featuresResident,
        })}
        <p style="margin:16px 0 0;color:#475569;font-size:14px;">Si tienes alguna duda durante los primeros días, escríbenos desde el centro de ayuda — respondemos en menos de 24 horas hábiles.</p>
      `,
      ctaText: isDoctor ? "Ir a mi panel de doctor" : "Explorar la plataforma",
      ctaUrl: isDoctor ? `${appUrl}/doctor` : `${appUrl}/lives`,
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
    console.error("Error in send-approval-email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

Deno.serve(handler);
