import { Resend } from "npm:resend@2.0.0";

import { requireAdminOrCron, AuthError, corsHeaders } from "../_shared/auth-guards.ts";
import { renderEmail, infoCard } from "../_shared/email-template.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface WelcomeEmailRequest {
  email: string;
  name: string;
  role: 'patient' | 'doctor' | 'resident';
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try { await requireAdminOrCron(req); } catch (__e) {
    if (__e instanceof AuthError) return __e.toResponse();
    return new Response(JSON.stringify({ error: 'auth failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const appUrl = "https://medical-masters.com";
    const { email, name, role }: WelcomeEmailRequest = await req.json();

    let subject: string;
    let html: string;

    if (role === 'patient') {
      subject = "Bienvenido a Medical Masters";
      html = renderEmail({
        preheader: "Tu cuenta está activa. Empieza a usar la plataforma.",
        accent: "info",
        eyebrow: "Cuenta activa",
        title: "Bienvenido a Medical Masters",
        subtitle: "Telemedicina certificada, sin filas y con tus expedientes siempre a la mano.",
        greeting: `Hola, ${name}`,
        bodyHtml: `
          ${infoCard({
            title: "Ya puedes",
            accent: "info",
            html: `
              <ul style="margin:6px 0 0;padding-left:22px;">
                <li>Ver transmisiones en vivo de médicos especialistas</li>
                <li>Acceder a grabaciones educativas</li>
                <li>Subir tu historial médico de forma segura</li>
                <li>Consultar con médicos verificados</li>
              </ul>`,
          })}
          ${infoCard({
            title: "Configura tu método de pago",
            accent: "warning",
            html: `<p style="margin:0;">Para acceder a contenido premium, suscripciones y consultas, recarga saldo en tu <strong>Wallet</strong> desde la plataforma con tarjeta de crédito o débito.</p>`,
          })}
        `,
        ctaText: "Ir a la plataforma",
        ctaUrl: appUrl,
        appUrl,
      });
    } else {
      // doctor o resident: solicitud recibida, en revisión
      subject = "Recibimos tu solicitud — Medical Masters";
      const isDoctor = role === 'doctor';
      html = renderEmail({
        preheader: "Tu solicitud está siendo revisada por nuestro equipo.",
        accent: "neutral",
        eyebrow: "En revisión",
        title: "Recibimos tu solicitud",
        subtitle: `Tu cuenta como ${isDoctor ? 'médico' : 'residente'} está en revisión. Te avisamos por correo cuando se apruebe.`,
        greeting: `Hola, ${name}`,
        bodyHtml: `
          <p style="margin:0 0 12px;">Nuestro equipo está verificando tu documentación. El proceso suele tomar <strong>24–48 horas hábiles</strong>.</p>
          ${!isDoctor ? `
          ${infoCard({
            title: "Beneficio para residentes",
            accent: "success",
            html: `<p style="margin:0;">Una vez aprobada tu cuenta, tendrás <strong>50% de descuento</strong> en todo el contenido educativo premium.</p>`,
          })}` : ""}
          <p style="margin:8px 0 0;color:#475569;font-size:14px;">Si tarda más de 48h o necesitas adelantar tu verificación, escríbenos desde el centro de ayuda.</p>
        `,
        ctaText: "Ver estado de mi cuenta",
        ctaUrl: appUrl,
        appUrl,
      });
    }

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
    console.error("Error in send-welcome-email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

Deno.serve(handler);
