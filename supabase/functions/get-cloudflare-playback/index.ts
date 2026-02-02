import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GET-CLOUDFLARE-PLAYBACK] ${step}${detailsStr}`);
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
    const { videoUid, liveInputUid, type = "recording" } = await req.json();
    
    if (!videoUid && !liveInputUid) {
      throw new Error("videoUid or liveInputUid is required");
    }

    if (type === "live" && liveInputUid) {
      // For live streams, return the playback URL directly
      // Get the subdomain from the account
      const accountResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/stream/live_inputs/${liveInputUid}`,
        {
          headers: {
            "Authorization": `Bearer ${cfApiToken}`,
          },
        }
      );

      if (!accountResponse.ok) {
        throw new Error("Failed to get live input info");
      }

      const inputData = await accountResponse.json();
      const input = inputData.result;

      logStep("Live input info retrieved", { uid: input.uid });

      return new Response(
        JSON.stringify({
          success: true,
          type: "live",
          playbackUrl: `https://customer-${cfAccountId.slice(0, 8)}.cloudflarestream.com/${input.uid}/manifest/video.m3u8`,
          iframeUrl: `https://customer-${cfAccountId.slice(0, 8)}.cloudflarestream.com/${input.uid}/iframe`,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // For recordings, generate a signed URL for secure playback
    logStep("Generating signed URL for recording", { videoUid });

    // Check if the video UID is a pending marker
    if (videoUid.startsWith("pending:")) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Recording is still processing",
          status: "processing",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 202,
        }
      );
    }

    // Get video details
    const videoResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/stream/${videoUid}`,
      {
        headers: {
          "Authorization": `Bearer ${cfApiToken}`,
        },
      }
    );

    if (!videoResponse.ok) {
      const errorData = await videoResponse.json();
      logStep("Error fetching video", errorData);
      throw new Error("Video not found");
    }

    const videoData = await videoResponse.json();
    const video = videoData.result;

    logStep("Video info retrieved", { 
      uid: video.uid, 
      duration: video.duration, 
      status: video.status?.state 
    });

    // Generate a signed token for playback (expires in 2 hours)
    // This requires Cloudflare Stream signing keys to be configured
    // For now, we'll use the public playback URL with requireSignedURLs = false
    // In production, you should enable signed URLs for better security

    const playbackUrl = video.playback?.hls || 
      `https://customer-${cfAccountId.slice(0, 8)}.cloudflarestream.com/${video.uid}/manifest/video.m3u8`;

    return new Response(
      JSON.stringify({
        success: true,
        type: "recording",
        playbackUrl,
        thumbnailUrl: video.thumbnail,
        duration: video.duration,
        status: video.status?.state,
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
