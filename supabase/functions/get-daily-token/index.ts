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

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Authenticate user (optional - visitors can watch lives)
    let userId: string | undefined;
    let userName = 'Visitante';

    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: userData } = await supabaseClient.auth.getUser(token);
      if (userData?.user) {
        userId = userData.user.id;
        logStep("User authenticated", { userId });

        // Get user profile with robust fallback
        const { data: profile } = await supabaseClient
          .from("profiles")
          .select("name")
          .eq("id", userId)
          .single();

        userName = profile?.name
          || userData.user.user_metadata?.name
          || (userData.user.email ? userData.user.email.split('@')[0] : 'Usuario');
      } else {
        logStep("No valid user session, proceeding as visitor");
      }
    } else {
      logStep("No auth header, proceeding as visitor");
    }

    // Parse request body
    const { roomName, isOwner = false, enableMedia = false } = await req.json();
    if (!roomName) throw new Error("roomName is required");

    logStep("Creating token", { roomName, isOwner, enableMedia, userName, isVisitor: !userId });

    // Configure token properties
    const tokenProperties: Record<string, any> = {
      room_name: roomName,
      is_owner: isOwner,
      ...(userId && { user_id: userId }),
      user_name: userName,
      // Token expires in 24 hours
      exp: Math.floor(Date.now() / 1000) + 86400,
      start_video_off: !enableMedia,
      start_audio_off: !enableMedia,
    };

    // Create meeting token for the viewer
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
      const errorData = await tokenResponse.json();
      logStep("Token creation failed", errorData);
      throw new Error(`Failed to create meeting token: ${errorData.error || "Unknown error"}`);
    }

    const tokenData = await tokenResponse.json();
    logStep("Viewer token created successfully");

    return new Response(
      JSON.stringify({
        success: true,
        token: tokenData.token,
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
