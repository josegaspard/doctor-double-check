import { createClient } from "npm:@supabase/supabase-js@2";

import { requireCronSecret, AuthError, corsHeaders } from "../_shared/auth-guards.ts";
import { renderEmail } from "../_shared/email-template.ts";
import { maskEmail } from "../_shared/log-redact.ts";
import { generateUnsubscribeToken } from "../_shared/unsubscribe-token.ts";
import { getDoctorTimezone, formatInTimezone } from "../_shared/doctor-timezone.ts";
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
      // Los bloqueos privados de agenda (type='blocked') no son eventos: no se avisa a nadie.
      .or("type.is.null,type.neq.blocked")
      .gte("scheduled_at", now.toISOString())
      .lte("scheduled_at", oneHourFromNow.toISOString());

    if (availError) {
      logStep("Error fetching availabilities", { error: availError.message });
      throw availError;
    }

    // Sin lives/consultas no se sale: más abajo van los recordatorios de citas.
    logStep("Found upcoming availabilities", { count: upcomingAvailabilities?.length ?? 0 });

    let totalEmailsSent = 0;
    const baseUrl = supabaseUrl.replace('.supabase.co', '.functions.supabase.co');
    const appUrl = "https://medical-masters.com";

    for (const availability of upcomingAvailabilities ?? []) {
      const { data: doctorProfile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", availability.doctor_id)
        .single();

      const doctorName = doctorProfile?.name || "Un doctor";
      // Hora en la zona del médico (el servidor corre en UTC).
      const doctorTz = await getDoctorTimezone(supabase, availability.doctor_id);
      const timeString = formatInTimezone(availability.scheduled_at, doctorTz, {
        hour: "2-digit",
        minute: "2-digit",
      });
      const dateString = formatInTimezone(availability.scheduled_at, doctorTz, {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).replace(/,?\s+(hora de|GMT).*$/, "");

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
                from: Deno.env.get('FROM_EMAIL') ?? 'Medical Masters <no-reply@notify.medical-masters.com>',
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

    // ── Citas confirmadas: recordatorio a paciente y médico 1 h antes ──────────────
    // appointments no tiene marca de enviado: se deduplica con email_history
    // (email_type 'appointment_reminder', content_id = cita, mismo destinatario).
    let appointmentEmailsSent = 0;
    const { data: upcomingAppointments, error: apptError } = await supabase
      .from("appointments")
      .select("id, patient_id, doctor_id, scheduled_at, modality, service_name")
      .eq("status", "confirmed")
      .gte("scheduled_at", now.toISOString())
      .lte("scheduled_at", oneHourFromNow.toISOString());
    if (apptError) logStep("Error fetching appointments", { error: apptError.message });

    for (const appt of upcomingAppointments ?? []) {
      const [{ data: patientProfile }, { data: doctorProf }, { data: already }] = await Promise.all([
        supabase.from("profiles").select("id, email, name").eq("id", appt.patient_id).maybeSingle(),
        supabase.from("profiles").select("id, email, name").eq("id", appt.doctor_id).maybeSingle(),
        supabase.from("email_history").select("recipient_email")
          .eq("email_type", "appointment_reminder").eq("content_id", appt.id).eq("status", "sent"),
      ]);
      const sentTo = new Set((already ?? []).map((r: { recipient_email: string }) => r.recipient_email));
      const tz = await getDoctorTimezone(supabase, appt.doctor_id);
      const when = formatInTimezone(appt.scheduled_at, tz);
      const doctorName = doctorProf?.name || "tu médico";
      const patientName = patientProfile?.name || "Paciente";
      const modalityText = appt.modality === "in_person"
        ? "La cita es presencial."
        : "La cita es por videollamada: entra unos minutos antes desde la plataforma.";

      const targets = [
        {
          profile: patientProfile, ctaUrl: `${appUrl}/my-appointments`,
          subject: `Recordatorio: tu cita con el Dr. ${doctorName} en menos de 1 hora`,
          title: "Tu cita es en menos de 1 hora",
          subtitle: `Dr. ${doctorName} · ${when}`,
        },
        {
          profile: doctorProf, ctaUrl: `${appUrl}/doctor/agenda`,
          subject: `Recordatorio: cita con ${patientName} en menos de 1 hora`,
          title: "Tienes una cita en menos de 1 hora",
          subtitle: `${patientName} · ${when}`,
        },
      ];

      for (const t of targets) {
        if (!t.profile?.email || sentTo.has(t.profile.email)) continue;
        const html = renderEmail({
          preheader: t.subtitle,
          accent: "warning",
          eyebrow: "Cita · En menos de 1 hora",
          title: t.title,
          subtitle: t.subtitle,
          greeting: `Hola, ${t.profile.name || ""}`,
          bodyHtml: `
            ${appt.service_name ? `<p style="margin:0 0 14px;color:#475569;">${String(appt.service_name).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string))}</p>` : ""}
            <p style="margin:0;color:#475569;">${modalityText}</p>
          `,
          ctaText: "Ver mis citas",
          ctaUrl: t.ctaUrl,
          appUrl,
        });
        let status = "sent";
        let errorMessage: string | null = null;
        try {
          const emailResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: Deno.env.get('FROM_EMAIL') ?? 'Medical Masters <no-reply@notify.medical-masters.com>',
              to: [t.profile.email],
              subject: t.subject,
              html,
            }),
          });
          if (!emailResponse.ok) throw new Error(`Resend API error: ${await emailResponse.text()}`);
          appointmentEmailsSent++;
          logStep("Appointment reminder sent", { appointmentId: appt.id, to: maskEmail(t.profile.email) });
        } catch (emailError: any) {
          status = "failed";
          errorMessage = emailError.message;
          logStep("Failed to send appointment reminder", { appointmentId: appt.id, to: maskEmail(t.profile.email), error: emailError.message });
        }
        await supabase.from('email_history').insert({
          doctor_id: appt.doctor_id,
          recipient_email: t.profile.email,
          recipient_name: t.profile.name,
          email_type: 'appointment_reminder',
          subject: t.subject,
          content_id: appt.id,
          content_title: appt.service_name,
          status,
          error_message: errorMessage,
        });
        if (status === "sent") {
          await supabase.from("notifications").insert({
            user_id: t.profile.id,
            type: "system",
            title: "Cita en menos de 1 hora",
            message: t.subtitle,
            data: { appointmentId: appt.id, scheduledAt: appt.scheduled_at },
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processedAvailabilities: upcomingAvailabilities?.length ?? 0,
        emailsSent: totalEmailsSent,
        processedAppointments: upcomingAppointments?.length ?? 0,
        appointmentEmailsSent,
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