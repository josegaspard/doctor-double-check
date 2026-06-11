import { createClient } from "npm:@supabase/supabase-js@2";

import { requireCronSecret, AuthError, corsHeaders } from "../_shared/auth-guards.ts";
import { renderEmail } from "../_shared/email-template.ts";
import { maskEmail } from "../_shared/log-redact.ts";
import { generateUnsubscribeToken } from "../_shared/unsubscribe-token.ts";
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-AVAILABILITY-REMINDERS] ${step}${detailsStr}`);
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // SECURITY (2026-05-11 audit): scheduled-only. x-cron-secret header required.
  try { requireCronSecret(req); } catch (__e) {
    if (__e instanceof AuthError) return __e.toResponse();
    return new Response(JSON.stringify({ error: 'auth failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    const { data: upcomingAvailabilities, error: availError } = await supabase
      .from("doctor_availability")
      .select("id, doctor_id, title, description, scheduled_at, type")
      .in("status", ["scheduled", "confirmed"])
      .eq("reminder_sent", false)
      .gte("scheduled_at", now.toISOString())
      .lte("scheduled_at", oneHourFromNow.toISOString());

    if (availError) {
      logStep("Error fetching availabilities", { error: availError.message });
      throw availError;
    }

    if (!upcomingAvailabilities || upcomingAvailabilities.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No upcoming availabilities to remind" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    logStep("Found upcoming availabilities", { count: upcomingAvailabilities.length });

    let totalEmailsSent = 0;
    const baseUrl = supabaseUrl.replace('.supabase.co', '.functions.supabase.co');
    const appUrl = "https://medical-masters.com";

    for (const availability of upcomingAvailabilities) {
      const { data: doctorProfile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", availability.doctor_id)
        .single();

      const doctorName = doctorProfile?.name || "Un doctor";
      const scheduledTime = new Date(availability.scheduled_at);
      const timeString = scheduledTime.toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const dateString = scheduledTime.toLocaleDateString("es-MX", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });

      const { data: subscribers } = await supabase
        .from("subscriptions")
        .select("subscriber_id")
        .eq("creator_id", availability.doctor_id)
        .eq("is_active", true)
        .eq("notify_on_availability", true);

      if (!subscribers || subscribers.length === 0) {
        logStep("No subscribers for doctor", { doctorId: availability.doctor_id });
        await supabase
          .from("doctor_availability")
          .update({ reminder_sent: true })
          .eq("id", availability.id);
        continue;
      }

      const subscriberIds = subscribers.map((s) => s.subscriber_id);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, name")
        .in("id", subscriberIds);

      if (profiles && profiles.length > 0) {
        const typeIcon = availability.type === "live" ? "🔴" : 
                         availability.type === "consultation" ? "💬" : "📅";
        const typeLabel = availability.type === "live" ? "Live" : 
                          availability.type === "consultation" ? "Consulta" : "Evento";

        for (const profile of profiles) {
          if (!profile.email) continue;

          const unsubscribeToken = await generateUnsubscribeToken(profile.id, availability.doctor_id, 'availability');
          const unsubscribeAllToken = await generateUnsubscribeToken(profile.id, availability.doctor_id, 'all');
          const subscriberName = profile.name || "Suscriptor";

          const subject = `Recordatorio: ${availability.title} en menos de 1 hora`;

          const html = renderEmail({
            preheader: `${doctorName}: ${availability.title} — ${dateString} a las ${timeString}`,
            accent: "warning",
            eyebrow: `${typeLabel} · En menos de 1 hora`,
            title: availability.title,
            subtitle: `${doctorName} · ${dateString} a las ${timeString}`,
            greeting: `Hola, ${subscriberName}`,
            bodyHtml: `
              ${availability.description ? `<p style="margin:0 0 14px;color:#475569;">${availability.description}</p>` : ""}
              <p style="margin:0;color:#475569;">Prepárate para conectarte unos minutos antes.</p>
            `,
            ctaText: "Ver próximos eventos",
            ctaUrl: `${appUrl}/lives`,
            appUrl,
            secondaryNote: `Recibes este correo porque sigues a ${doctorName}.<br/>
              <a href="${baseUrl}/unsubscribe-email?token=${unsubscribeToken}" style="color:#64748b;">Pausar recordatorios</a>
              &nbsp;·&nbsp;
              <a href="${baseUrl}/unsubscribe-email?token=${unsubscribeAllToken}" style="color:#64748b;">Cancelar todos los correos</a>`,
          });

          try {
            const emailResponse = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: Deno.env.get('FROM_EMAIL') ?? 'Medical Masters <no-reply@medical-masters.com>',
                to: [profile.email],
                subject,
                html,
              }),
            });

            if (!emailResponse.ok) {
              const errorData = await emailResponse.text();
              throw new Error(`Resend API error: ${errorData}`);
            }

            await supabase.from('email_history').insert({
              doctor_id: availability.doctor_id,
              recipient_email: profile.email,
              recipient_name: profile.name,
              email_type: 'availability_reminder',
              subject,
              content_id: availability.id,
              content_title: availability.title,
              status: 'sent',
            });

            totalEmailsSent++;
            logStep("Email sent", { to: maskEmail(profile.email) });
          } catch (emailError: any) {
            logStep("Failed to send email", { to: maskEmail(profile.email), error: emailError.message });

            await supabase.from('email_history').insert({
              doctor_id: availability.doctor_id,
              recipient_email: profile.email,
              recipient_name: profile.name,
              email_type: 'availability_reminder',
              subject,
              content_id: availability.id,
              content_title: availability.title,
              status: 'failed',
              error_message: emailError.message,
            });
          }
        }
      }

      const notificationType = availability.type === "live" ? "doctor_live" : "doctor_availability";
      
      await supabase.rpc("notify_subscribers", {
        p_doctor_id: availability.doctor_id,
        p_notification_type: notificationType,
        p_title: `Recordatorio: ${availability.title}`,
        p_message: `Comienza en menos de 1 hora (${timeString})`,
        p_data: { availability_id: availability.id, type: availability.type },
      });

      await supabase
        .from("doctor_availability")
        .update({ reminder_sent: true })
        .eq("id", availability.id);

      logStep("Processed availability", { 
        id: availability.id, 
        emailsSent: totalEmailsSent 
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        processedAvailabilities: upcomingAvailabilities.length,
        emailsSent: totalEmailsSent,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    logStep("ERROR", { message: error.message });
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});