import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[NOTIFY-NEW-CHAT] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Use service role key for admin operations
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);

    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const { doctorId, patientName, sessionId, isDoubleCheck } = await req.json();
    if (!doctorId || !sessionId) throw new Error("doctorId and sessionId are required");

    logStep("Notification request", { doctorId, patientName, sessionId, isDoubleCheck });

    // Get patient info
    const { data: patientProfile } = await supabaseAdmin
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single();

    const displayName = patientName || patientProfile?.name || 'Un paciente';

    // Create notification for doctor
    const notificationTitle = isDoubleCheck 
      ? '🔍 Nueva Segunda Opinión'
      : '💬 Nueva consulta iniciada';
    
    const notificationMessage = isDoubleCheck
      ? `${displayName} ha solicitado una segunda opinión`
      : `${displayName} ha iniciado una consulta contigo`;

    const { error: notifError } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: doctorId,
        type: 'chat_message',
        title: notificationTitle,
        message: notificationMessage,
        data: {
          sessionId,
          patientId: user.id,
          patientName: displayName,
          isDoubleCheck: isDoubleCheck || false,
          url: '/chat',
        },
      });

    if (notifError) {
      logStep("Error creating notification", { error: notifError.message });
    } else {
      logStep("Notification created for doctor", { doctorId });
    }

    // Check if doctor has push notifications enabled
    const { data: doctorPrefs } = await supabaseAdmin
      .from('notification_preferences')
      .select('push_notifications, notify_chat_messages')
      .eq('user_id', doctorId)
      .maybeSingle();

    // Send push notification if enabled
    if (doctorPrefs?.push_notifications && doctorPrefs?.notify_chat_messages) {
      const { data: pushSubs } = await supabaseAdmin
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('user_id', doctorId);

      if (pushSubs && pushSubs.length > 0) {
        logStep("Sending push notifications", { count: pushSubs.length });
        
        // Call the send-push-notification function for each subscription
        for (const sub of pushSubs) {
          try {
            await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push-notification`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({
                subscription: sub,
                payload: {
                  title: notificationTitle,
                  body: notificationMessage,
                  data: { url: '/chat', sessionId },
                  tag: `chat-${sessionId}`,
                },
              }),
            });
          } catch (pushError) {
            logStep("Push notification error", { error: String(pushError) });
          }
        }
      }
    }

    // Check if doctor has email notifications enabled
    if (doctorPrefs?.notify_chat_messages) {
      const { data: doctorProfile } = await supabaseAdmin
        .from('profiles')
        .select('email, name')
        .eq('id', doctorId)
        .single();

      if (doctorProfile?.email) {
        logStep("Sending email notification to doctor", { email: doctorProfile.email });
        
        // Call the send-chat-notification-email function if it exists
        // For now, we just log it - can be implemented later
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
