import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GET-CLOUDFLARE-PLAYBACK] ${step}${detailsStr}`);
};

// Customer subdomain for playback URLs
const CUSTOMER_SUBDOMAIN = "customer-3afz9zesalmyroc9.cloudflarestream.com";

type CloudflareVideo = {
  uid: string;
  duration?: number;
  thumbnail?: string | null;
  status?: { state?: string };
  liveInput?: string | { uid?: string } | null;
  meta?: Record<string, unknown> | null;
  created?: string;
};

const getLiveInputUidFromVideo = (video: CloudflareVideo): string | null => {
  if (!video.liveInput) return null;
  if (typeof video.liveInput === "string") return video.liveInput;
  return video.liveInput.uid ?? null;
};

const sortNewestFirst = (videos: CloudflareVideo[]) => {
  return [...videos].sort((a, b) => {
    const aTime = a.created ? Date.parse(a.created) : 0;
    const bTime = b.created ? Date.parse(b.created) : 0;
    return bTime - aTime;
  });
};

Deno.serve(async (req) => {
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
    const { videoUid, liveInputUid, type = "recording", recordingId } = await req.json();
    
    if (!videoUid && !liveInputUid) {
      throw new Error("videoUid or liveInputUid is required");
    }

    // Use the constant subdomain

    // For live streams
    if (type === "live" && liveInputUid) {
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
          playbackUrl: `https://${CUSTOMER_SUBDOMAIN}/${input.uid}/manifest/video.m3u8`,
          iframeUrl: `https://${CUSTOMER_SUBDOMAIN}/${input.uid}/iframe`,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Check if the video UID is a pending marker
    const isPending = videoUid && videoUid.startsWith("pending:");
    const actualVideoUid = isPending ? videoUid.replace("pending:", "") : videoUid;

    if (isPending) {
      logStep("Recording is pending, checking live input outputs", { liveInputUid: actualVideoUid });
      
      // Cloudflare recordings are stored as regular videos.
      // IMPORTANT: The reliable way is listing videos for a given live input.
      let videos: CloudflareVideo[] = [];

      // Optional: fetch liveId from DB to increase match accuracy
      let liveIdFromDb: string | null = null;
      if (recordingId) {
        const { data: recRow, error: recErr } = await supabaseClient
          .from('recordings')
          .select('live_id')
          .eq('id', recordingId)
          .maybeSingle();
        if (!recErr && recRow?.live_id) {
          liveIdFromDb = recRow.live_id;
        }
      }

      const MAX_PAGES = 10;
      // 1) Preferred: list videos attached to this live input directly
      for (let page = 1; page <= MAX_PAGES; page++) {
        const listResponse = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/stream/live_inputs/${actualVideoUid}/videos?per_page=100&page=${page}`,
          {
            headers: {
              "Authorization": `Bearer ${cfApiToken}`,
            },
          }
        );

        if (!listResponse.ok) {
          logStep("Live input videos endpoint failed", { status: listResponse.status, page });
          break;
        }

        const listData = await listResponse.json();
        const candidates: CloudflareVideo[] = listData.result || [];
        if (candidates.length === 0) {
          logStep("No more candidates", { page, endpoint: "live_inputs/:uid/videos" });
          break;
        }

        videos.push(...candidates);
      }

      // 2) Fallback: scan global videos list and match by liveInput/meta (older behavior)
      if (videos.length === 0) {
        for (let page = 1; page <= MAX_PAGES; page++) {
          const listResponse = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/stream?per_page=100&page=${page}`,
            {
              headers: {
                "Authorization": `Bearer ${cfApiToken}`,
              },
            }
          );

          if (!listResponse.ok) {
            logStep("Videos list failed", { status: listResponse.status, page });
            break;
          }

          const listData = await listResponse.json();
          const candidates: CloudflareVideo[] = listData.result || [];

          const matched = candidates.filter((v) => {
            const liveInputUid = getLiveInputUidFromVideo(v);
            return (
              liveInputUid === actualVideoUid ||
              (liveIdFromDb && (v.meta as any)?.liveId === liveIdFromDb)
            );
          });

          if (matched.length > 0) {
            videos = matched;
            logStep("Videos matched via fallback scan", { page, matched: matched.length, candidates: candidates.length, liveIdFromDb });
            break;
          }

          if (candidates.length === 0) {
            logStep("No more candidates", { page, endpoint: "/stream" });
            break;
          }
        }
      }

      videos = sortNewestFirst(videos);

      // Log all found videos for debugging
      if (videos.length > 0) {
        logStep("Videos found", videos.map((v: any) => ({ 
          uid: v.uid, 
          status: v.status?.state, 
          duration: v.duration,
          liveInput: v.liveInput,
        })));
      }

      // Find a ready video
      const readyVideo = videos.find((v: any) => v.status?.state === "ready");

      if (readyVideo) {
        logStep("Found ready video!", { 
          uid: readyVideo.uid, 
          duration: readyVideo.duration 
        });

        // Update the recording in database if recordingId provided
        if (recordingId) {
          const { error: updateError } = await supabaseClient
            .from('recordings')
            .update({
              video_url: readyVideo.uid,
              duration: Math.floor(readyVideo.duration || 0),
              thumbnail_url: readyVideo.thumbnail || null,
            })
            .eq('id', recordingId);

          if (updateError) {
            logStep("Error updating recording", updateError);
          } else {
            logStep("Recording updated successfully");
          }
        }

        const playbackUrl = `https://${CUSTOMER_SUBDOMAIN}/${readyVideo.uid}/manifest/video.m3u8`;
        
        return new Response(
          JSON.stringify({
            success: true,
            type: "recording",
            playbackUrl,
            thumbnailUrl: readyVideo.thumbnail,
            duration: readyVideo.duration,
            status: "ready",
            videoUid: readyVideo.uid,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }

      // Check if there's a video still processing
      const processingVideo = videos.find((v: any) => 
        v.status?.state !== "ready" && v.status?.state !== "error"
      );

      if (processingVideo) {
        logStep("Video still processing", { state: processingVideo.status?.state });
        return new Response(
          JSON.stringify({
            success: false,
            error: "Recording is still processing",
            status: processingVideo.status?.state || "processing",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 202,
          }
        );
      }

      // No video found yet - might still be processing at Cloudflare
      logStep("No video found for this live input yet");
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

    // For ready recordings (non-pending), get video details directly
    logStep("Getting video details", { videoUid: actualVideoUid });

    const videoResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/stream/${actualVideoUid}`,
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

    // If the video isn't ready yet, report as processing so the client can poll.
    const state = video.status?.state;
    if (state && state !== "ready") {
      logStep("Video not ready yet", { uid: video.uid, state });
      return new Response(
        JSON.stringify({
          success: false,
          error: "Recording is still processing",
          status: state,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 202,
        }
      );
    }

    const playbackUrl =
      video.playback?.hls ||
      `https://${CUSTOMER_SUBDOMAIN}/${video.uid}/manifest/video.m3u8`;

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
