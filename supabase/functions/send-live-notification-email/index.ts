import { createClient } from "npm:@supabase/supabase-js@2";
import { requireUserJWT, AuthError, corsHeaders } from "../_shared/auth-guards.ts";
import { Resend } from "npm:resend@2.0.0";
import { renderEmail } from "../_shared/email-template.ts";
import { generateUnsubscribeToken } from "../_shared/unsubscribe-token.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-LIVE-NOTIFICATION-EMAIL] ${step}${detailsStr}`);
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // SECURITY (2026-05-11 audit): authenticated doctor only.
  try { await requireUserJWT(req); } catch (__e) {
    if (__e instanceof AuthError) return __e.toResponse();
    return new Response(JSON.stringify({ error: 'auth failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const { doctorId, liveId, title, description } = await req.json();

    if (!doctorId || !liveId) {
      return new Response(
        JSON.stringify({ error: "doctorId and liveId are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    logStep("Processing live notification emails", { doctorId, liveId, title });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get doctor info
    const { data: doctorProfile, error: doctorError } = await supabaseClient
      .from('profiles')
      .select('name, avatar_url')
      .eq('id', doctorId)
      .single();

    if (doctorError || !doctorProfile) {
      logStep("Error fetching doctor profile", { error: doctorError?.message });
      return new Response(
        JSON.stringify({ error: "Doctor not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const doctorName = doctorProfile.name || "Un doctor";

    // Get active subscribers with email notifications enabled for lives
    const { data: subscriptions, error: subsError } = await supabaseClient
      .from('subscriptions')
      .select('id, subscriber_id, notify_on_live')
      .eq('creator_id', doctorId)
      .eq('is_active', true)
      .eq('notify_on_live', true);

    if (subsError) {
      logStep("Error fetching subscriptions", { error: subsError.message });
      return new Response(
        JSON.stringify({ error: "Error fetching subscriptions" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      logStep("No subscribers with email notifications enabled");
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No subscribers with live notifications enabled" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    logStep("Found subscribers", { count: subscriptions.length });

    // Get subscriber profiles with emails
    const subscriberIds = subscriptions.map(s => s.subscriber_id);
    const { data: profiles, error: profilesError } = await supabaseClient
      .from('profiles')
      .select('id, email, name')
      .in('id', subscriberIds);

    if (profilesError || !profiles) {
      logStep("Error fetching subscriber profiles", { error: profilesError?.message });
      return new Response(
        JSON.stringify({ error: "Error fetching subscriber profiles" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const baseUrl = Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '.functions.supabase.co') || '';
    const appUrl = "https://medical-masters.com";

    let sentCount = 0;
    let failedCount = 0;

    for (const profile of profiles) {
      if (!profile.email) continue;

      const subscription = subscriptions.find(s => s.subscriber_id === profile.id);
      if (!subscription) continue;

      const unsubscribeLiveToken = await generateUnsubscribeToken(profile.id, doctorId, 'live');
      const unsubscribeAllToken = await generateUnsubscribeToken(profile.id, doctorId, 'all');

      const subject = `${doctorName} está en vivo ahora`;
      const subscriberName = profile.name || "Suscriptor";

      const html = renderEmail({
        preheader: `${doctorName} inició una transmisión en vivo: ${title || 'Transmisión'}`,
        accent: "danger",
        eyebrow: "En vivo ahora",
        title: `${doctorName} está en vivo`,
        subtitle: title || 'Acaba de iniciar una transmisión.',
        greeting: `Hola, ${subscriberName}`,
        bodyHtml: `
          <div style="margin:8px 0 16px;padding:18px 18px;background:#fef2f2;border-left:4px solid #ef4444;border-radius:10px;">
            <h2 style="margin:0 0 6px;font-size:18px;color:#0f172a;">${title || 'Transmisión en vivo'}</h2>
            ${description ? `<p style="margin:0;font-size:14px;color:#475569;line-height:22px;">${description}</p>` : ""}
          </div>
          <p style="margin:0;font-size:14px;color:#475569;">Los lives son en tiempo real — no se pueden ver después si no estás conectado.</p>
        `,
        ctaText: "Entrar a la transmisión",
        ctaUrl: `${appUrl}/live/${liveId}`,
        appUrl,
        secondaryNote: `Recibes este correo porque sigues a ${doctorName}.<br/>
          <a href="${baseUrl}/unsubscribe-email?token=${unsubscribeLiveToken}" style="color:#64748b;">Pausar notificaciones de lives</a>
          &nbsp;·&nbsp;
          <a href="${baseUrl}/unsubscribe-email?token=${unsubscribeAllToken}" style="color:#64748b;">Cancelar todos los correos</a>`,
      });

      try {
        await resend.emails.send({
          from: Deno.env.get("FROM_EMAIL") ?? "Medical Masters <no-reply@medical-masters.com>",
          to: [profile.email],
          subject,
          html,
        });

        // Log to email history
        await supabaseClient.from('email_history').insert({
          doctor_id: doctorId,
          recipient_email: profile.email,
          recipient_name: profile.name,
          email_type: 'live_started',
          subject,
          content_id: liveId,
          content_title: title,
          status: 'sent',
        });

        sentCount++;
        logStep("Email sent successfully", { to: profile.email });
      } catch (emailError: any) {
        failedCount++;
        logStep("Failed to send email", { to: profile.email, error: emailError.message });

        // Log failed attempt
        await supabaseClient.from('email_history').insert({
          doctor_id: doctorId,
          recipient_email: profile.email,
          recipient_name: profile.name,
          email_type: 'live_started',
          subject,
          content_id: liveId,
          content_title: title,
          status: 'failed',
          error_message: emailError.message,
        });
      }
    }

    logStep("Completed sending emails", { sent: sentCount, failed: failedCount });

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: sentCount, 
        failed: failedCount,
        total: profiles.length 
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
