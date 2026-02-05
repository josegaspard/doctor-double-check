import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseAdmin = () => createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } }
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[RATING-TRIGGER] Starting post-consultation rating check");
    
    const db = supabaseAdmin();
    
    // Find consultations that were marked as completed in the last 5 minutes
    // but haven't been rated yet
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const now = new Date().toISOString();
    
    const { data: completedConsultations, error: consultError } = await db
      .from("consultations")
      .select(`
        id,
        patient_id,
        doctor_id,
        ended_at
      `)
      .eq("status", "completed")
      .gte("ended_at", fiveMinutesAgo)
      .lte("ended_at", now);
    
    if (consultError) {
      console.error("[RATING-TRIGGER] Error fetching consultations:", consultError);
      throw consultError;
    }
    
    console.log(`[RATING-TRIGGER] Found ${completedConsultations?.length || 0} recently completed consultations`);
    
    let notificationsSent = 0;
    
    for (const consultation of completedConsultations || []) {
      // Check if rating already exists
      const { data: existingRating } = await db
        .from("consultation_ratings")
        .select("id")
        .eq("consultation_id", consultation.id)
        .maybeSingle();
      
      if (existingRating) {
        console.log(`[RATING-TRIGGER] Rating already exists for consultation ${consultation.id}`);
        continue;
      }
      
      // Check if we already sent a notification for this consultation
      const { data: existingNotification } = await db
        .from("notifications")
        .select("id")
        .eq("user_id", consultation.patient_id)
        .eq("type", "rating_request")
        .contains("data", { consultation_id: consultation.id })
        .maybeSingle();
      
      if (existingNotification) {
        console.log(`[RATING-TRIGGER] Notification already sent for consultation ${consultation.id}`);
        continue;
      }
      
      // Get doctor name
      const { data: doctorProfile } = await db
        .from("profiles")
        .select("name")
        .eq("id", consultation.doctor_id)
        .single();
      
      // Send notification to patient to rate the consultation
      const { error: notifError } = await db
        .from("notifications")
        .insert({
          user_id: consultation.patient_id,
          type: "rating_request",
          title: "⭐ Califica tu consulta",
          message: `¿Cómo fue tu experiencia con ${doctorProfile?.name || "tu médico"}? Tu opinión nos ayuda a mejorar.`,
          data: {
            consultation_id: consultation.id,
            doctor_id: consultation.doctor_id,
            url: "/chat",
          },
        });
      
      if (notifError) {
        console.error(`[RATING-TRIGGER] Error sending notification for consultation ${consultation.id}:`, notifError);
      } else {
        notificationsSent++;
        console.log(`[RATING-TRIGGER] Rating notification sent for consultation ${consultation.id}`);
      }
    }
    
    console.log(`[RATING-TRIGGER] Completed. Sent ${notificationsSent} rating notifications`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        consultationsChecked: completedConsultations?.length || 0,
        notificationsSent 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[RATING-TRIGGER] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
