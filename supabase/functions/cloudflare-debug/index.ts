import { requireAdminJWT, AuthError, corsHeaders } from "../_shared/auth-guards.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // SECURITY (2026-05-11 audit): admin-only. Previously open.
  try { await requireAdminJWT(req); } catch (__e) {
    if (__e instanceof AuthError) return __e.toResponse();
    return new Response(JSON.stringify({ error: 'auth failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const cfAccountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
    const cfApiToken = Deno.env.get("CLOUDFLARE_API_TOKEN");
    
    if (!cfAccountId || !cfApiToken) {
      throw new Error("Cloudflare credentials not configured");
    }

    const results: Record<string, unknown> = {
      accountId: cfAccountId.slice(0, 8) + "...",
      timestamp: new Date().toISOString(),
    };

    // 1) List all videos
    const videosRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/stream?per_page=50`,
      { headers: { "Authorization": `Bearer ${cfApiToken}` } }
    );
    const videosData = await videosRes.json();
    
    results.videos = {
      success: videosData.success,
      count: videosData.result?.length || 0,
      items: (videosData.result || []).map((v: any) => ({
        uid: v.uid,
        status: v.status?.state,
        duration: v.duration,
        created: v.created,
        liveInput: typeof v.liveInput === 'string' ? v.liveInput : v.liveInput?.uid,
        meta: v.meta,
      })),
    };

    // 2) List all live inputs
    const liveInputsRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/stream/live_inputs?per_page=50`,
      { headers: { "Authorization": `Bearer ${cfApiToken}` } }
    );
    const liveInputsData = await liveInputsRes.json();
    
    results.liveInputs = {
      success: liveInputsData.success,
      count: liveInputsData.result?.length || 0,
      items: (liveInputsData.result || []).map((li: any) => ({
        uid: li.uid,
        created: li.created,
        meta: li.meta,
        recording: li.recording,
        status: li.status,
      })),
    };

    // 2.1) Fetch the most recent live input details (includes recording + status fields)
    const recentLiveInput = liveInputsData.result?.[0];
    if (recentLiveInput?.uid) {
      const recentDetailsRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/stream/live_inputs/${recentLiveInput.uid}`,
        { headers: { "Authorization": `Bearer ${cfApiToken}` } }
      );
      const recentDetailsData = await recentDetailsRes.json();

      results.recentLiveInputDetails = {
        requestedUid: recentLiveInput.uid,
        success: recentDetailsData.success,
        errors: recentDetailsData.errors,
        result: recentDetailsData.result
          ? {
              uid: recentDetailsData.result.uid,
              created: recentDetailsData.result.created,
              meta: recentDetailsData.result.meta,
              recording: recentDetailsData.result.recording,
              status: recentDetailsData.result.status,
              rtmps: recentDetailsData.result.rtmps,
              webRTC: recentDetailsData.result.webRTC,
            }
          : null,
      };
    }

    // 3) For the most recent live input, check its videos
    if (recentLiveInput) {
      const liVideosRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/stream/live_inputs/${recentLiveInput.uid}/videos?per_page=20`,
        { headers: { "Authorization": `Bearer ${cfApiToken}` } }
      );
      const liVideosData = await liVideosRes.json();
      
      results.recentLiveInputVideos = {
        liveInputUid: recentLiveInput.uid,
        success: liVideosData.success,
        errors: liVideosData.errors,
        count: liVideosData.result?.length || 0,
        items: (liVideosData.result || []).map((v: any) => ({
          uid: v.uid,
          status: v.status?.state,
          duration: v.duration,
          created: v.created,
        })),
      };
    }

    return new Response(JSON.stringify(results, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
