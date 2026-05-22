import { createClient } from "npm:@supabase/supabase-js@2";

import { requireAdminOrCron, AuthError, corsHeaders } from "../_shared/auth-guards.ts";
import { renderEmail, EmailAccent } from "../_shared/email-template.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

interface VerificationEmailRequest {
  user_id: string;
  status: "pending" | "in_progress" | "verified" | "failed" | "expired";
  user_email?: string;
  user_name?: string;
}

const getEmailContent = (status: string, name: string) => {
  const map: Record<string, { subject: string; eyebrow: string; title: string; subtitle: string; message: string; accent: EmailAccent; cta: string }> = {
    pending: {
      subject: "Verificación de identidad recibida",
      eyebrow: "Recibido",
      title: "Recibimos tu documentación",
      subtitle: "Tu solicitud de verificación está en cola.",
      message: "Tu solicitud de verificación de identidad fue recibida y está siendo procesada. Te avisaremos por correo cuando tengamos una actualización.",
      accent: "info",
      cta: "Ver estado",
    },
    in_progress: {
      subject: "Verificación de identidad en proceso",
      eyebrow: "En revisión",
      title: "Tu verificación está siendo revisada",
      subtitle: "Nuestro equipo está validando tu documentación.",
      message: "Este proceso puede tomar entre 24 y 48 horas hábiles. Te avisaremos por correo cuando esté listo.",
      accent: "info",
      cta: "Ver estado",
    },
    verified: {
      subject: "Identidad verificada — Medical Masters",
      eyebrow: "Verificado",
      title: "Tu identidad fue verificada",
      subtitle: "Ya tienes acceso completo a la plataforma.",
      message: "Tu cuenta ahora está verificada. Puedes usar todas las funcionalidades, incluyendo consultas con médicos, contenido premium y expediente seguro.",
      accent: "success",
      cta: "Ir a la plataforma",
    },
    failed: {
      subject: "Verificación de identidad: requiere atención",
      eyebrow: "Requiere atención",
      title: "No pudimos verificar tu identidad",
      subtitle: "Necesitamos que envíes la documentación nuevamente.",
      message: "Las imágenes que recibimos no fueron suficientes. Por favor reintenta asegurándote de que sean claras, legibles y muestren el documento completo sin reflejos.",
      accent: "warning",
      cta: "Reintentar verificación",
    },
    expired: {
      subject: "Verificación de identidad expirada",
      eyebrow: "Expirado",
      title: "Tu verificación expiró",
      subtitle: "Reactiva tu cuenta iniciando el proceso nuevamente.",
      message: "Por seguridad, tu verificación de identidad expiró. Reanúdala desde la plataforma para mantener tu cuenta verificada.",
      accent: "warning",
      cta: "Reiniciar verificación",
    },
  };

  const c = map[status] || map.pending;
  const appUrl = "https://medical-masters.com";

  return {
    subject: c.subject,
    html: renderEmail({
      preheader: c.subtitle,
      accent: c.accent,
      eyebrow: c.eyebrow,
      title: c.title,
      subtitle: c.subtitle,
      greeting: `Hola, ${name}`,
      bodyHtml: `<p style="margin:0;">${c.message}</p>`,
      ctaText: c.cta,
      ctaUrl: `${appUrl}/verify-identity`,
      appUrl,
    }),
  };
};

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
        from: Deno.env.get("FROM_EMAIL") ?? "Medical Masters <no-reply@medical-masters.com>",
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
