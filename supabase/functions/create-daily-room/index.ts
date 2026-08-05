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

    const doctorName = profile?.name
      || userData.user.user_metadata?.name
      || "Doctor";

    // Parse request body — now accepts `mode` parameter
    const { liveId, title, enableRecording = false, mode = 'live' } = await req.json();
    if (!liveId) throw new Error("liveId is required");

    // 'appointment' = sala 1:1 de una cita agendada; se trata como consulta a nivel
    // de propiedades de sala (ambos transmiten), pero autoriza contra `appointments`.
    const isAppointment = mode === 'appointment';
    const isConsultation = mode === 'consultation' || isAppointment;
    logStep("Creating Daily.co room", { liveId, title, enableRecording, mode });

    // ── Authorization: the caller must OWN / participate in this resource ──
    // Without this, any authenticated user could request an is_owner:true
    // broadcast token for someone else's live/consultation.
    let authorized = false;
    if (isAppointment) {
      // liveId == appointment id; autoriza al doctor o al paciente de la cita.
      const { data: ap } = await supabaseClient
        .from('appointments').select('id')
        .eq('id', liveId)
        .or(`doctor_id.eq.${userId},patient_id.eq.${userId}`)
        .maybeSingle();
      if (ap) authorized = true;
    } else if (isConsultation) {
      // liveId == consultation id OR clinical_session id (Meetings union)
      const { data: c } = await supabaseClient
        .from('consultations').select('id')
        .eq('id', liveId)
        .or(`doctor_id.eq.${userId},patient_id.eq.${userId}`)
        .maybeSingle();
      if (c) authorized = true;
      if (!authorized) {
        const { data: cs } = await supabaseClient
          .from('clinical_sessions').select('id')
          .eq('id', liveId).eq('organizer_id', userId).maybeSingle();
        if (cs) authorized = true;
      }
      if (!authorized) {
        const { data: inv } = await supabaseClient
          .from('clinical_session_invitations').select('id')
          .eq('session_id', liveId).eq('doctor_id', userId).maybeSingle();
        if (inv) authorized = true;
      }
    } else {
      const { data: l } = await supabaseClient
        .from('lives').select('id')
        .eq('id', liveId).eq('doctor_id', userId).maybeSingle();
      if (l) authorized = true;
    }
    if (!authorized) {
      logStep("Authorization denied", { userId, liveId, mode });
      return new Response(
        JSON.stringify({ success: false, error: "No autorizado para esta sala" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a room in Daily.co
    const roomName = `${isConsultation ? 'call' : 'live'}-${liveId.slice(0, 8)}-${Date.now()}`;
    
    // Configure room properties based on mode
    const roomProperties: Record<string, any> = {
      enable_chat: true,
      enable_screenshare: true,
      start_video_off: false,
      start_audio_off: false,
      exp: Math.floor(Date.now() / 1000) + 86400,
      enable_people_ui: true,
      enable_network_ui: true,
    };

    if (isConsultation) {
      // 1:1 consultation — both participants can broadcast
      roomProperties.max_participants = 4;
      roomProperties.owner_only_broadcast = false;
    } else {
      // Live streaming — only owner broadcasts
      roomProperties.max_participants = 200;
      roomProperties.owner_only_broadcast = true;
    }

    // Only add recording if explicitly enabled
    if (enableRecording) {
      roomProperties.enable_recording = "cloud";
    }

    logStep("Room properties configured", { maxParticipants: roomProperties.max_participants, ownerOnlyBroadcast: roomProperties.owner_only_broadcast, mode });

    const dailyResponse = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${dailyApiKey}`,
      },
      body: JSON.stringify({
        name: roomName,
        // SEGURIDAD (auditoría 2026-08-05): sin este campo Daily crea la sala
        // como "public" y CUALQUIERA con la URL entra SIN token. Los nombres de
        // sala son legibles por anónimos (lives.daily_room_name,
        // clinical_sessions.daily_room_url), así que una sala pública dejaba
        // entrar a un desconocido a una consulta médica con cámara y micro.
        // Todas las rutas de join del frontend ya piden token a get-daily-token
        // (DailyVideoPlayer, LivePreviewPlayer, useWebRTCCall), y ese token se
        // emite con room_name atado, así que "private" no rompe a nadie.
        privacy: "private",
        properties: roomProperties,
      }),
    });

    if (!dailyResponse.ok) {
      const errorData = await dailyResponse.json();
      logStep("Daily.co API error", errorData);
      
      if (errorData.info?.includes("max_participants") || errorData.info?.includes("cannot be set")) {
        logStep("Retrying with free tier limits");
        
        const freeTierProperties: Record<string, any> = {
          max_participants: isConsultation ? 4 : 10,
          enable_chat: true,
          enable_screenshare: true,
          start_video_off: false,
          start_audio_off: false,
          exp: Math.floor(Date.now() / 1000) + 86400,
          enable_people_ui: true,
          owner_only_broadcast: isConsultation ? false : true,
        };

        const retryResponse = await fetch("https://api.daily.co/v1/rooms", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${dailyApiKey}`,
          },
          body: JSON.stringify({
            name: `${roomName}-retry`,
            privacy: "private", // idem: el reintento free-tier también debe ser privado
            properties: freeTierProperties,
          }),
        });

        if (!retryResponse.ok) {
          const retryError = await retryResponse.json();
          logStep("Retry also failed", retryError);
          throw new Error(`Daily.co API error: ${retryError.error || retryError.info || "Unknown error"}`);
        }

        const retryRoomData = await retryResponse.json();
        logStep("Room created with free tier limits", { roomName: retryRoomData.name, url: retryRoomData.url });

        return await createTokenAndRespond(
          retryRoomData,
          liveId,
          userId,
          doctorName,
          dailyApiKey,
          supabaseClient,
          corsHeaders,
          logStep,
          isConsultation
        );
      }
      
      throw new Error(`Daily.co API error: ${errorData.error || errorData.info || "Unknown error"}`);
    }

    const roomData = await dailyResponse.json();
    logStep("Room created", { roomName: roomData.name, url: roomData.url });

    return await createTokenAndRespond(
      roomData,
      liveId,
      userId,
      doctorName,
      dailyApiKey,
      supabaseClient,
      corsHeaders,
      logStep,
      isConsultation
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
  logStep: (step: string, details?: any) => void,
  isConsultation: boolean
) {
  // For live streams, save room name to lives table
  if (!isConsultation) {
    const { count } = await supabaseClient
      .from('lives')
      .update({ daily_room_name: roomData.name })
      .eq('id', liveId)
      .eq('doctor_id', userId);

    if (count && count > 0) {
      logStep("Saved daily_room_name to lives table", { liveId, roomName: roomData.name });
    } else {
      logStep("No lives row updated", { liveId });
    }
  }

  // Create meeting token for the owner (doctor)
  const tokenProperties: Record<string, any> = {
    room_name: roomData.name,
    is_owner: true,
    user_id: userId,
    user_name: doctorName,
    exp: Math.floor(Date.now() / 1000) + 86400,
    enable_recording_ui: true,
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
