import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CLOUDFLARE-STREAM] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const cfAccountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
    const cfApiToken = Deno.env.get("CLOUDFLARE_API_TOKEN");
    
    if (!cfAccountId || !cfApiToken) {
      throw new Error("Cloudflare credentials not configured");
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
    const { liveId, title, enableRecording = true } = await req.json();
    if (!liveId) throw new Error("liveId is required");

    logStep("Creating Cloudflare Stream live input", { liveId, title, enableRecording });

    // Create a Live Input in Cloudflare Stream
    // This gives us a RTMPS/WebRTC endpoint for the broadcaster
    const createInputResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/stream/live_inputs`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${cfApiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          meta: {
            name: title || `Live ${liveId}`,
            liveId: liveId,
          },
          // Recording is automatically enabled in Cloudflare Stream
          recording: {
            mode: enableRecording ? "automatic" : "off",
            // Keep recordings for 30 days
            timeoutSeconds: 60 * 60 * 24 * 30,
          },
        }),
      }
    );

    if (!createInputResponse.ok) {
      const errorData = await createInputResponse.json();
      logStep("Cloudflare API error", errorData);
      throw new Error(`Cloudflare API error: ${JSON.stringify(errorData.errors || errorData)}`);
    }

    const inputData = await createInputResponse.json();
    const liveInput = inputData.result;

    logStep("Live input created", { 
      uid: liveInput.uid,
      webRTC: liveInput.webRTC?.url,
      rtmps: liveInput.rtmps?.url,
    });

    // Save the Cloudflare stream info to the lives table
    // We use daily_room_name column to store the Cloudflare live input UID
    const { error: updateError } = await supabaseClient
      .from('lives')
      .update({ 
        daily_room_name: liveInput.uid,
      })
      .eq('id', liveId)
      .eq('doctor_id', userId);

    if (updateError) {
      logStep("Error updating live with stream ID", updateError);
    } else {
      logStep("Saved stream ID to lives table", { liveId, streamId: liveInput.uid });
    }

    return new Response(
      JSON.stringify({
        success: true,
        stream: {
          uid: liveInput.uid,
          // WebRTC URL for browser-based streaming (WHIP protocol)
          webRTCUrl: liveInput.webRTC?.url,
          // RTMPS for OBS/external software
          rtmpsUrl: liveInput.rtmps?.url,
          rtmpsStreamKey: liveInput.rtmps?.streamKey,
          // Playback URL for viewers (HLS)
          playbackUrl: `https://customer-${cfAccountId.slice(0, 8)}.cloudflarestream.com/${liveInput.uid}/manifest/video.m3u8`,
          // Iframe embed URL
          iframeUrl: `https://customer-${cfAccountId.slice(0, 8)}.cloudflarestream.com/${liveInput.uid}/iframe`,
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
