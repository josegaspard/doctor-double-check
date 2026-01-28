import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find availabilities starting in the next 60 minutes that haven't had reminders sent
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    const { data: upcomingAvailabilities, error: availError } = await supabase
      .from("doctor_availability")
      .select("id, doctor_id, title, scheduled_at, type")
      .in("status", ["scheduled", "confirmed"])
      .eq("reminder_sent", false)
      .gte("scheduled_at", now.toISOString())
      .lte("scheduled_at", oneHourFromNow.toISOString());

    if (availError) {
      console.error("Error fetching availabilities:", availError);
      throw availError;
    }

    if (!upcomingAvailabilities || upcomingAvailabilities.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No upcoming availabilities to remind" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Found ${upcomingAvailabilities.length} upcoming availabilities`);

    let totalNotificationsSent = 0;

    for (const availability of upcomingAvailabilities) {
      // Get doctor name
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

      // Get all subscribers of this doctor with push subscriptions
      const { data: subscribers } = await supabase
        .from("subscriptions")
        .select("subscriber_id")
        .eq("creator_id", availability.doctor_id)
        .eq("is_active", true)
        .eq("notify_on_availability", true);

      if (!subscribers || subscribers.length === 0) {
        console.log(`No subscribers for doctor ${availability.doctor_id}`);
        // Mark as sent anyway to avoid re-processing
        await supabase
          .from("doctor_availability")
          .update({ reminder_sent: true })
          .eq("id", availability.id);
        continue;
      }

      const subscriberIds = subscribers.map((s) => s.subscriber_id);

      // Get push subscriptions for these subscribers
      const { data: pushSubscriptions } = await supabase
        .from("push_subscriptions")
        .select("*")
        .in("user_id", subscriberIds);

      if (pushSubscriptions && pushSubscriptions.length > 0) {
        // Configure VAPID for push notifications
        webpush.setVapidDetails(
          "mailto:notifications@drdoublecheck.com",
          vapidPublicKey,
          vapidPrivateKey
        );

        const typeLabel = availability.type === "live" ? "🔴 Live" : 
                          availability.type === "consultation" ? "💬 Consulta" : "📅 Evento";

        const payload = JSON.stringify({
          title: `${typeLabel} en menos de 1 hora`,
          body: `${doctorName}: ${availability.title} - ${timeString}`,
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          data: {
            url: "/lives",
            availabilityId: availability.id,
          },
        });

        for (const subscription of pushSubscriptions) {
          try {
            await webpush.sendNotification(
              {
                endpoint: subscription.endpoint,
                keys: {
                  p256dh: subscription.p256dh,
                  auth: subscription.auth,
                },
              },
              payload
            );
            totalNotificationsSent++;
          } catch (pushError: any) {
            console.error(`Push notification failed for user ${subscription.user_id}:`, pushError);
            
            // Remove invalid subscriptions
            if (pushError.statusCode === 410 || pushError.statusCode === 404) {
              await supabase
                .from("push_subscriptions")
                .delete()
                .eq("id", subscription.id);
            }
          }
        }
      }

      // Create in-app notifications for all subscribers
      const notificationType = availability.type === "live" ? "doctor_live" : "doctor_availability";
      
      await supabase.rpc("notify_subscribers", {
        p_doctor_id: availability.doctor_id,
        p_notification_type: notificationType,
        p_title: `Recordatorio: ${availability.title}`,
        p_message: `Comienza en menos de 1 hora (${timeString})`,
        p_data: { availability_id: availability.id, type: availability.type },
      });

      // Mark reminder as sent
      await supabase
        .from("doctor_availability")
        .update({ reminder_sent: true })
        .eq("id", availability.id);

      console.log(`Processed availability ${availability.id}, sent ${totalNotificationsSent} push notifications`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        processedAvailabilities: upcomingAvailabilities.length,
        pushNotificationsSent: totalNotificationsSent,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-availability-reminders:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
