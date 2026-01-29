import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-DAILY-ROOM] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const dailyApiKey = Deno.env.get("DAILY_API_KEY");
    if (!dailyApiKey) {
      throw new Error("DAILY_API_KEY is not configured");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("User not authenticated");

    const userId = userData.user.id;
    logStep("User authenticated", { userId });

    // Parse request body
    const { liveId, title } = await req.json();
    if (!liveId) throw new Error("liveId is required");

    logStep("Creating Daily.co room", { liveId, title });

    // Create a room in Daily.co
    const roomName = `live-${liveId.slice(0, 8)}-${Date.now()}`;
    
    const dailyResponse = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${dailyApiKey}`,
      },
      body: JSON.stringify({
        name: roomName,
        properties: {
          max_participants: 100,
          enable_chat: true,
          enable_screenshare: true,
          enable_recording: "cloud",
          start_video_off: false,
          start_audio_off: false,
          exp: Math.floor(Date.now() / 1000) + 86400, // Expires in 24 hours
        },
      }),
    });

    if (!dailyResponse.ok) {
      const errorData = await dailyResponse.json();
      logStep("Daily.co API error", errorData);
      throw new Error(`Daily.co API error: ${errorData.error || "Unknown error"}`);
    }

    const roomData = await dailyResponse.json();
    logStep("Room created", { roomName: roomData.name, url: roomData.url });

    // Save the daily_room_name to the lives table
    const { error: updateError } = await supabaseClient
      .from('lives')
      .update({ daily_room_name: roomData.name })
      .eq('id', liveId)
      .eq('doctor_id', userId);

    if (updateError) {
      logStep("Error updating live with room name", updateError);
      // Don't throw - room was created successfully
    } else {
      logStep("Saved daily_room_name to lives table", { liveId, roomName: roomData.name });
    }

    // Create meeting token for the owner (doctor)
    const tokenResponse = await fetch("https://api.daily.co/v1/meeting-tokens", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${dailyApiKey}`,
      },
      body: JSON.stringify({
        properties: {
          room_name: roomData.name,
          is_owner: true,
          user_id: userId,
          user_name: "Doctor",
          enable_recording: "cloud",
          exp: Math.floor(Date.now() / 1000) + 86400,
        },
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error("Failed to create meeting token");
    }

    const tokenData = await tokenResponse.json();
    logStep("Owner token created");

    return new Response(
      JSON.stringify({
        success: true,
        room: {
          name: roomData.name,
          url: roomData.url,
          ownerToken: tokenData.token,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
