import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[END-CLOUDFLARE-STREAM] ${step}${detailsStr}`);
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
    const { liveId, streamUid, saveRecording = true } = await req.json();
    if (!liveId) throw new Error("liveId is required");

    logStep("Ending Cloudflare Stream", { liveId, streamUid, saveRecording });

    // Get the live record to get stream UID if not provided
    const { data: liveRecord, error: liveError } = await supabaseClient
      .from('lives')
      .select('daily_room_name, recording_price, title, specialty, description, tags, started_at')
      .eq('id', liveId)
      .eq('doctor_id', userId)
      .single();

    if (liveError || !liveRecord) {
      throw new Error("Live not found or not authorized");
    }

    const actualStreamUid = streamUid || liveRecord.daily_room_name;
    logStep("Stream UID resolved", { actualStreamUid });

    // Update live status to ended
    const { error: updateError } = await supabaseClient
      .from('lives')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString(),
      })
      .eq('id', liveId)
      .eq('doctor_id', userId);

    if (updateError) {
      logStep("Error updating live status", updateError);
    }

    let recordingId = null;

    // If we should save the recording, we need to wait for Cloudflare to process it
    // The recording will be available via webhook, but we can also poll for it
    if (saveRecording && actualStreamUid) {
      logStep("Checking for recording...");

      // Give Cloudflare a moment to finalize the recording
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get videos associated with this live input (reliable endpoint)
      // NOTE: Using /stream?search=<uid> is not reliable because it may not match by liveInput.
      let videosResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/stream/live_inputs/${actualStreamUid}/videos?per_page=100&page=1`,
        {
          headers: {
            "Authorization": `Bearer ${cfApiToken}`,
          },
        }
      );

      // Fallback for older accounts/APIs
      if (!videosResponse.ok) {
        logStep("Live input videos endpoint failed, falling back to search", { status: videosResponse.status });
        videosResponse = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/stream?per_page=100&page=1&search=${actualStreamUid}`,
          {
            headers: {
              "Authorization": `Bearer ${cfApiToken}`,
            },
          }
        );
      }

      if (videosResponse.ok) {
        const videosData = await videosResponse.json();
        const videos = videosData.result || [];
        
        logStep("Found videos from stream", { count: videos.length });

        // Get the most recent video for this live input
        const recording = videos
          .filter((v: any) => {
            const liveInputUid = typeof v.liveInput === 'string' ? v.liveInput : v.liveInput?.uid;
            return liveInputUid === actualStreamUid || v.meta?.liveId === liveId;
          })
          .sort((a: any, b: any) => {
            const aTime = a.created ? Date.parse(a.created) : 0;
            const bTime = b.created ? Date.parse(b.created) : 0;
            return bTime - aTime;
          })[0];

        if (recording) {
          logStep("Recording found", { 
            videoId: recording.uid, 
            duration: recording.duration,
            status: recording.status?.state,
          });

          // Create recording entry in database
          const { data: newRecording, error: recError } = await supabaseClient
            .from('recordings')
            .insert({
              doctor_id: userId,
              live_id: liveId,
              title: liveRecord.title,
              description: liveRecord.description,
              specialty: liveRecord.specialty,
              tags: liveRecord.tags,
              duration: Math.floor(recording.duration || 0),
              price: liveRecord.recording_price || 0,
              // Store Cloudflare video UID - we'll use signed URLs for playback
              video_url: recording.uid,
              thumbnail_url: recording.thumbnail || null,
            })
            .select()
            .single();

          if (recError) {
            logStep("Error creating recording", recError);
          } else {
            recordingId = newRecording.id;
            logStep("Recording created", { recordingId });
          }
        } else {
          logStep("No recording found yet - it may still be processing");
          
          // Calculate duration from live start time
          const liveDurationSeconds = liveRecord.started_at
            ? Math.floor((Date.now() - new Date(liveRecord.started_at).getTime()) / 1000)
            : 0;

          // Create a placeholder recording that will be updated via webhook
          const { data: newRecording, error: recError } = await supabaseClient
            .from('recordings')
            .insert({
              doctor_id: userId,
              live_id: liveId,
              title: liveRecord.title,
              description: liveRecord.description,
              specialty: liveRecord.specialty,
              tags: liveRecord.tags,
              duration: liveDurationSeconds,
              price: liveRecord.recording_price || 0,
              video_url: `pending:${actualStreamUid}`, // Marker for pending processing
              thumbnail_url: null,
            })
            .select()
            .single();

          if (!recError && newRecording) {
            recordingId = newRecording.id;
            logStep("Placeholder recording created", { recordingId, duration: liveDurationSeconds });
          }
        }
      }
    }

    // Optionally disconnect the live input (keeps recordings but stops accepting new streams)
    // We don't delete it to preserve any recordings
    logStep("Stream ended successfully", { liveId, recordingId });

    return new Response(
      JSON.stringify({
        success: true,
        recordingId,
        message: saveRecording 
          ? "Stream ended - recording being processed" 
          : "Stream ended",
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
