import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-DAILY-ROOM] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
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

    // Get user profile for the doctor's name
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("name")
      .eq("id", userId)
      .single();

    const doctorName = profile?.name || "Doctor";

    // Parse request body
    const { liveId, title, enableRecording = false } = await req.json();
    if (!liveId) throw new Error("liveId is required");

    logStep("Creating Daily.co room", { liveId, title, enableRecording });

    // Create a room in Daily.co
    // Room name must be unique and URL-safe
    const roomName = `live-${liveId.slice(0, 8)}-${Date.now()}`;
    
    // Configure room properties
    // NOTE: For 200+ participants, you need a paid Daily.co plan
    // The free plan limits to ~4-10 participants
    // With a paid plan, set max_participants to 200-1000 based on your plan
    const roomProperties: Record<string, any> = {
      // For free plan: 10 participants max
      // For paid plan: Change to 200-1000 based on your needs
      max_participants: 200,
      enable_chat: true,
      enable_screenshare: true,
      start_video_off: false,
      start_audio_off: false,
      // Room expires in 24 hours
      exp: Math.floor(Date.now() / 1000) + 86400,
      // Enable large meetings mode for scalability
      enable_people_ui: true,
      // Optimize for large audiences (viewers mostly watch, don't transmit)
      owner_only_broadcast: true,
      // Enable network quality monitoring
      enable_network_ui: true,
    };

    // Only add recording if explicitly enabled AND you have a paid plan
    // The free plan does NOT support cloud recording
    if (enableRecording) {
      roomProperties.enable_recording = "cloud";
    }

    logStep("Room properties configured", { maxParticipants: roomProperties.max_participants, ownerOnlyBroadcast: true });

    const dailyResponse = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${dailyApiKey}`,
      },
      body: JSON.stringify({
        name: roomName,
        properties: roomProperties,
      }),
    });

    if (!dailyResponse.ok) {
      const errorData = await dailyResponse.json();
      logStep("Daily.co API error", errorData);
      
      // If the error is about max_participants, try with a lower limit
      if (errorData.info?.includes("max_participants") || errorData.info?.includes("cannot be set")) {
        logStep("Retrying with free tier limits");
        
        // Fallback to free tier settings
        const freeTierProperties: Record<string, any> = {
          max_participants: 10,
          enable_chat: true,
          enable_screenshare: true,
          start_video_off: false,
          start_audio_off: false,
          exp: Math.floor(Date.now() / 1000) + 86400,
          enable_people_ui: true,
        };

        const retryResponse = await fetch("https://api.daily.co/v1/rooms", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${dailyApiKey}`,
          },
          body: JSON.stringify({
            name: `${roomName}-retry`,
            properties: freeTierProperties,
          }),
        });

        if (!retryResponse.ok) {
          const retryError = await retryResponse.json();
          logStep("Retry also failed", retryError);
          throw new Error(`Daily.co API error: ${retryError.error || retryError.info || "Unknown error"}`);
        }

        const retryRoomData = await retryResponse.json();
        logStep("Room created with free tier limits", { roomName: retryRoomData.name, url: retryRoomData.url, maxParticipants: 10 });

        // Continue with the retry room data
        return await createTokenAndRespond(
          retryRoomData,
          liveId,
          userId,
          doctorName,
          dailyApiKey,
          supabaseClient,
          corsHeaders,
          logStep
        );
      }
      
      throw new Error(`Daily.co API error: ${errorData.error || errorData.info || "Unknown error"}`);
    }

    const roomData = await dailyResponse.json();
    logStep("Room created", { roomName: roomData.name, url: roomData.url, maxParticipants: roomProperties.max_participants });

    return await createTokenAndRespond(
      roomData,
      liveId,
      userId,
      doctorName,
      dailyApiKey,
      supabaseClient,
      corsHeaders,
      logStep
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

async function createTokenAndRespond(
  roomData: any,
  liveId: string,
  userId: string,
  doctorName: string,
  dailyApiKey: string,
  supabaseClient: any,
  corsHeaders: Record<string, string>,
  logStep: (step: string, details?: any) => void
) {
  // Try to save the daily_room_name to the lives table (for live streams)
  // For consultations, this will simply not match any row — that's expected
  const { error: updateError, count } = await supabaseClient
    .from('lives')
    .update({ daily_room_name: roomData.name })
    .eq('id', liveId)
    .eq('doctor_id', userId);

  if (count && count > 0) {
    logStep("Saved daily_room_name to lives table", { liveId, roomName: roomData.name });
  } else {
    logStep("No lives row updated (may be a consultation room)", { liveId });
  }

  // Create meeting token for the owner (doctor)
  // Owner token has special permissions
  const tokenProperties: Record<string, any> = {
    room_name: roomData.name,
    is_owner: true,
    user_id: userId,
    user_name: doctorName,
    exp: Math.floor(Date.now() / 1000) + 86400,
    // Owner can start/stop recording if available
    enable_recording_ui: true,
    // Owner can manage participants
    start_video_off: false,
    start_audio_off: false,
  };

  const tokenResponse = await fetch("https://api.daily.co/v1/meeting-tokens", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${dailyApiKey}`,
    },
    body: JSON.stringify({
      properties: tokenProperties,
    }),
  });

  if (!tokenResponse.ok) {
    const tokenError = await tokenResponse.json();
    logStep("Token creation failed", tokenError);
    throw new Error("Failed to create meeting token");
  }

  const tokenData = await tokenResponse.json();
  logStep("Owner token created successfully");

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
}
