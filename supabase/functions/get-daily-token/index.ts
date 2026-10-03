import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GET-DAILY-TOKEN] ${step}${detailsStr}`);
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Resolve caller identity (optional for live viewers)
    let userId: string | undefined;
    let userName = 'Visitante';

    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData } = await userClient.auth.getUser();
      if (userData?.user) {
        userId = userData.user.id;
        logStep("User authenticated", { userId });
        const { data: profile } = await userClient
          .from("profiles")
          .select("name")
          .eq("id", userId)
          .single();
        userName = profile?.name
          || userData.user.user_metadata?.name
          || (userData.user.email ? userData.user.email.split('@')[0] : 'Usuario');
      }
    }

    const { roomName, isOwner = false, enableMedia = false } = await req.json();
    if (!roomName) {
      return new Response(
        JSON.stringify({ success: false, error: "roomName is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authorize the join against DB state:
    //   - Live rooms (lives.daily_room_name = roomName): public viewers allowed,
    //     only the live's doctor can claim isOwner.
    //   - Consultation rooms (consultations.video_room_name = roomName): require
    //     auth AND caller must be patient_id or doctor_id; isOwner only allowed
    //     for the doctor.
    // Any other roomName is rejected — prevents random join via leaked room
    // names that don't map to a tracked resource.
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: liveRow } = await admin
      .from("lives")
      .select("id, doctor_id, status")
      .eq("daily_room_name", roomName)
      .maybeSingle();

    let isConsultation = false;
    let consultationOwnerId: string | null = null;
    if (!liveRow) {
      const { data: consultRow } = await admin
        .from("consultations")
        .select("id, patient_id, doctor_id, status")
        .eq("video_room_name", roomName)
        .maybeSingle();

      if (!consultRow) {
        logStep("Room not found in lives or consultations — rejected", { roomName });
        return new Response(
          JSON.stringify({ success: false, error: "Room not authorized" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      isConsultation = true;
      consultationOwnerId = consultRow.doctor_id;

      if (!userId) {
        logStep("Consultation requires auth", { roomName });
        return new Response(
          JSON.stringify({ success: false, error: "Authentication required for consultation" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const isParticipant = userId === consultRow.patient_id || userId === consultRow.doctor_id;
      if (!isParticipant) {
        logStep("User not a participant in consultation", { roomName, userId });
        return new Response(
          JSON.stringify({ success: false, error: "Not a participant in this consultation" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (isOwner && userId !== consultRow.doctor_id) {
        // Only the doctor can claim owner privileges on the consultation room
        return new Response(
          JSON.stringify({ success: false, error: "Only the doctor can join as owner" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // Live room
      if (isOwner && userId !== liveRow.doctor_id) {
        return new Response(
          JSON.stringify({ success: false, error: "Only the live's doctor can join as owner" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Un live terminado ya no tiene sala útil: no se emiten tokens.
      if (liveRow.status === 'ended') {
        return new Response(
          JSON.stringify({ success: false, error: "Live has ended" }),
          { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Interruptor "Acceso para PACIENTES" (site_settings.feature_toggles.enable_patient_access,
      // apagado por defecto): con él apagado la web no deja entrar a pacientes, y aquí
      // se aplica también para quien pida el token directamente a la API.
      if (userId && userId !== liveRow.doctor_id) {
        const { data: roleRows } = await admin.from("user_roles").select("role").eq("user_id", userId);
        const roles = (roleRows || []).map((r: any) => r.role);
        const isOnlyPatient = roles.includes("patient") &&
          !roles.some((r: string) => r === "doctor" || r === "resident" || r === "admin");
        if (isOnlyPatient) {
          const { data: togglesRow } = await admin
            .from("site_settings").select("value").eq("id", "feature_toggles").maybeSingle();
          const patientAccess = (togglesRow?.value as any)?.enable_patient_access === true;
          if (!patientAccess) {
            logStep("Patient access disabled — live token rejected", { roomName, userId });
            return new Response(
              JSON.stringify({ success: false, error: "Patient access is disabled" }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }
    }

    logStep("Authorized", { roomName, kind: isConsultation ? 'consultation' : 'live', userId, isOwner });

    // Visitantes sin sesión en un live: la web les deja ver 60 s de vista previa
    // (LiveVisitorGate freeSeconds=60). El token dura eso más un margen y los saca
    // de la sala al caducar, para que no se pueda ver el live entero sin cuenta.
    const isLiveVisitor = !isConsultation && !userId;
    const VISITOR_TOKEN_SECONDS = 90;

    const tokenProperties: Record<string, any> = {
      room_name: roomName,
      is_owner: isOwner,
      ...(userId && { user_id: userId }),
      user_name: userName,
      exp: Math.floor(Date.now() / 1000) + (isLiveVisitor ? VISITOR_TOKEN_SECONDS : 86400),
      ...(isLiveVisitor && { eject_at_token_exp: true }),
      start_video_off: !enableMedia,
      start_audio_off: !enableMedia,
    };

    const tokenResponse = await fetch("https://api.daily.co/v1/meeting-tokens", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${dailyApiKey}`,
      },
      body: JSON.stringify({ properties: tokenProperties }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      logStep("Token creation failed", errorData);
      throw new Error(`Failed to create meeting token: ${errorData.error || "Unknown error"}`);
    }

    const tokenData = await tokenResponse.json();
    logStep("Token created successfully");

    return new Response(
      JSON.stringify({ success: true, token: tokenData.token }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
