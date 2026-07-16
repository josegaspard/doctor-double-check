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

/**
 * Verify user has access to the recording:
 * - Owner of the recording (doctor)
 * - Admin role
 * - Active purchase row in `purchases` table
 * - Free recording (price == 0)
 * Returns true if access granted, false otherwise.
 */
async function verifyRecordingAccess(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  recordingId: string
): Promise<{ allowed: boolean; reason?: string }> {
  // 1) Admin role
  const { data: roleRow } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();
  if (roleRow) return { allowed: true, reason: 'admin' };

  // 2) Recording details (owner / price / live_id)
  const { data: rec, error: recErr } = await supabaseAdmin
    .from('recordings')
    .select('doctor_id, price')
    .eq('id', recordingId)
    .maybeSingle();
  if (recErr || !rec) return { allowed: false, reason: 'recording_not_found' };

  // 3) Owner doctor
  if (rec.doctor_id === userId) return { allowed: true, reason: 'owner' };

  // 4) Free recording
  if (Number(rec.price) === 0) return { allowed: true, reason: 'free' };

  // 5) Active purchase
  const { data: purchase } = await supabaseAdmin
    .from('purchases')
    .select('id')
    .eq('user_id', userId)
    .eq('recording_id', recordingId)
    .maybeSingle();
  if (purchase) return { allowed: true, reason: 'purchased' };

  return { allowed: false, reason: 'no_purchase' };
}

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

    // Parse request body first so we can allow public live playback
    const { videoUid, liveInputUid, type = "recording", recordingId } = await req.json();

    if (!videoUid && !liveInputUid) {
      throw new Error("videoUid or liveInputUid is required");
    }

    const isLiveRequest = type === "live" && !!liveInputUid;

    // Anti-IDOR: para grabaciones servimos el asset DE la grabación autorizada,
    // nunca el videoUid arbitrario del body. Se rellena tras validar el acceso.
    let overrideVideoUid: string | null = null;

    // Keep auth required for recordings, but allow live playback for any viewer
    let authedUserId: string | null = null;
    if (!isLiveRequest) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(
          JSON.stringify({ success: false, error: "Forbidden: missing authorization" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
        );
      }

      const token = authHeader.replace("Bearer ", "");
      const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
      if (userError || !userData.user) {
        return new Response(
          JSON.stringify({ success: false, error: "Forbidden: invalid token" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
        );
      }
      authedUserId = userData.user.id;
      logStep("User authenticated", { userId: authedUserId });

      // STRICT GATING: must have recordingId + valid purchase/owner/admin
      if (!recordingId) {
        return new Response(
          JSON.stringify({ success: false, error: "Forbidden: recordingId required" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
        );
      }

      const access = await verifyRecordingAccess(supabaseClient, authedUserId, recordingId);
      if (!access.allowed) {
        logStep("Access denied", { userId: authedUserId, recordingId, reason: access.reason });
        return new Response(
          JSON.stringify({ success: false, error: "Forbidden: No purchase found", reason: access.reason }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
        );
      }
      logStep("Access granted", { userId: authedUserId, recordingId, reason: access.reason });

      // Derivar el asset a servir DEL recordingId autorizado (no del videoUid del body).
      // Así, aunque el atacante pase el recordingId de una grabación gratis/suya y el
      // videoUid de una grabación de pago ajena, se sirve el asset de SU grabación.
      const { data: authRec } = await supabaseClient
        .from("recordings")
        .select("video_url")
        .eq("id", recordingId)
        .maybeSingle();
      if (authRec?.video_url) {
        overrideVideoUid = authRec.video_url as string;
      }
    } else {
      logStep("Public live playback request", { liveInputUid });
    }

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
      const liveState = input?.status?.current?.state || "unknown";

      logStep("Live input info retrieved", { uid: input.uid, liveState });

      if (liveState !== "connected") {
        return new Response(
          JSON.stringify({
            success: false,
            type: "live",
            status: liveState,
            error: "Live input is not connected",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }

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

    // Check if the video UID is a pending marker. Para grabaciones usamos el asset
    // autorizado (overrideVideoUid); para live seguimos con el videoUid del body.
    const effectiveVideoUid = overrideVideoUid ?? videoUid;
    const isPending = effectiveVideoUid && effectiveVideoUid.startsWith("pending:");
    const actualVideoUid = isPending ? effectiveVideoUid.replace("pending:", "") : effectiveVideoUid;

    if (isPending) {
      logStep("Recording is pending, checking live input outputs", { liveInputUid: actualVideoUid });
      
      let videos: CloudflareVideo[] = [];

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

      if (videos.length > 0) {
        logStep("Videos found", videos.map((v: any) => ({ 
          uid: v.uid, 
          status: v.status?.state, 
          duration: v.duration,
          liveInput: v.liveInput,
        })));
      }

      const readyVideo = videos.find((v: any) => v.status?.state === "ready");

      if (readyVideo) {
        logStep("Found ready video!", { 
          uid: readyVideo.uid, 
          duration: readyVideo.duration 
        });

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
