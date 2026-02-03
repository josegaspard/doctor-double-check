import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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
      })),
    };

    // 3) For the most recent live input, check its videos
    const recentLiveInput = liveInputsData.result?.[0];
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
