import { createClient } from "npm:@supabase/supabase-js@2";

import { requireCronSecret, AuthError, corsHeaders } from "../_shared/auth-guards.ts";
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-AVAILABILITY-REMINDERS] ${step}${detailsStr}`);
};

const generateUnsubscribeToken = (subscriberId: string, doctorId: string, type: string): string => {
  return btoa(`${subscriberId}:${doctorId}:${type}`);
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

          const unsubscribeToken = generateUnsubscribeToken(profile.id, availability.doctor_id, 'availability');
          const unsubscribeAllToken = generateUnsubscribeToken(profile.id, availability.doctor_id, 'all');
          const subscriberName = profile.name || "Suscriptor";

          const subject = `${typeIcon} Recordatorio: ${availability.title} en menos de 1 hora`;

          const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 16px;">⏰</div>
      <h1 style="color: white; margin: 0; font-size: 28px;">¡Recordatorio!</h1>
    </div>
    
    <div style="background: white; padding: 32px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
      <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
        Hola <strong>${subscriberName}</strong>,
      </p>
      
      <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
        <strong>${doctorName}</strong> tiene un evento programado que comienza en menos de 1 hora:
      </p>
      
      <div style="background: linear-gradient(135deg, #fffbeb, #fef3c7); border-radius: 12px; padding: 24px; margin-bottom: 24px; border-left: 4px solid #f59e0b;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
          <span style="font-size: 24px;">${typeIcon}</span>
          <span style="background: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">${typeLabel}</span>
        </div>
        <h2 style="color: #1e293b; margin: 0 0 8px; font-size: 20px;">${availability.title}</h2>
        ${availability.description ? `<p style="color: #64748b; margin: 0 0 12px; font-size: 14px;">${availability.description}</p>` : ''}
        <p style="color: #92400e; margin: 0; font-size: 14px; font-weight: 600;">
          📅 ${dateString} a las ${timeString}
        </p>
      </div>
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="${appUrl}/lives" style="display: inline-block; background: linear-gradient(135deg, #f59e0b, #d97706); color: white; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);">
          Ver Próximos Eventos
        </a>
      </div>
      
      <p style="color: #94a3b8; font-size: 13px; text-align: center; margin-top: 32px;">
        ¡No te lo pierdas! Prepárate para participar.
      </p>
    </div>
    
    <div style="text-align: center; padding: 24px;">
      <p style="color: #94a3b8; font-size: 12px; margin: 0 0 8px;">
        Recibiste este email porque sigues a ${doctorName} en Medical Masters.
      </p>
      <p style="color: #94a3b8; font-size: 12px; margin: 0;">
        <a href="${baseUrl}/unsubscribe-email?token=${unsubscribeToken}" style="color: #64748b;">Desuscribirse de recordatorios</a>
        &nbsp;|&nbsp;
        <a href="${baseUrl}/unsubscribe-email?token=${unsubscribeAllToken}" style="color: #64748b;">Desuscribirse de todos los emails</a>
      </p>
    </div>
  </div>
</body>
</html>
          `;

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
            logStep("Email sent", { to: profile.email });
          } catch (emailError: any) {
            logStep("Failed to send email", { to: profile.email, error: emailError.message });

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