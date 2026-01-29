import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-LIVE-NOTIFICATION-EMAIL] ${step}${detailsStr}`);
};

// Generate unsubscribe token
const generateUnsubscribeToken = (subscriberId: string, doctorId: string, type: string): string => {
  return btoa(`${subscriberId}:${doctorId}:${type}`);
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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
    const appUrl = "https://doc-seek-relay.lovable.app";

    let sentCount = 0;
    let failedCount = 0;

    for (const profile of profiles) {
      if (!profile.email) continue;

      const subscription = subscriptions.find(s => s.subscriber_id === profile.id);
      if (!subscription) continue;

      const unsubscribeLiveToken = generateUnsubscribeToken(profile.id, doctorId, 'live');
      const unsubscribeAllToken = generateUnsubscribeToken(profile.id, doctorId, 'all');

      const subject = `🔴 ¡${doctorName} está en vivo ahora!`;
      const subscriberName = profile.name || "Suscriptor";

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: linear-gradient(135deg, #ef4444, #dc2626); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 16px;">🔴</div>
      <h1 style="color: white; margin: 0; font-size: 28px;">¡En Vivo Ahora!</h1>
    </div>
    
    <div style="background: white; padding: 32px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
      <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
        Hola <strong>${subscriberName}</strong>,
      </p>
      
      <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
        <strong>${doctorName}</strong> acaba de iniciar una transmisión en vivo:
      </p>
      
      <div style="background: linear-gradient(135deg, #fef2f2, #fee2e2); border-radius: 12px; padding: 24px; margin-bottom: 24px; border-left: 4px solid #ef4444;">
        <h2 style="color: #1e293b; margin: 0 0 8px; font-size: 20px;">${title || 'Transmisión en vivo'}</h2>
        ${description ? `<p style="color: #64748b; margin: 0; font-size: 14px;">${description}</p>` : ''}
      </div>
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="${appUrl}/live/${liveId}" style="display: inline-block; background: linear-gradient(135deg, #ef4444, #dc2626); color: white; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);">
          Ver Transmisión en Vivo
        </a>
      </div>
      
      <p style="color: #94a3b8; font-size: 13px; text-align: center; margin-top: 32px;">
        ¡No te lo pierdas! Los lives son una oportunidad única para aprender en tiempo real.
      </p>
    </div>
    
    <div style="text-align: center; padding: 24px;">
      <p style="color: #94a3b8; font-size: 12px; margin: 0 0 8px;">
        Recibiste este email porque sigues a ${doctorName} en Dr Double Check.
      </p>
      <p style="color: #94a3b8; font-size: 12px; margin: 0;">
        <a href="${baseUrl}/unsubscribe-email?token=${unsubscribeLiveToken}" style="color: #64748b;">Desuscribirse de notificaciones de lives</a>
        &nbsp;|&nbsp;
        <a href="${baseUrl}/unsubscribe-email?token=${unsubscribeAllToken}" style="color: #64748b;">Desuscribirse de todos los emails</a>
      </p>
    </div>
  </div>
</body>
</html>
      `;

      try {
        await resend.emails.send({
          from: "Dr Double Check <onboarding@resend.dev>",
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
