import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, cf-webhook-auth",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CLOUDFLARE-WEBHOOK] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    // Verify Cloudflare webhook signature
    const webhookSecret = Deno.env.get("CLOUDFLARE_WEBHOOK_SECRET");
    const signature = req.headers.get("cf-webhook-auth");
    if (!webhookSecret || !signature || signature !== webhookSecret) {
      logStep("Unauthorized: invalid or missing webhook signature");
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    logStep("Payload received", body);

    // Cloudflare Stream webhook event structure
    // See: https://developers.cloudflare.com/stream/manage-video-library/using-webhooks/
    const { 
      uid,              // Video UID
      readyToStream,    // Video is ready to be played
      duration,         // Duration in seconds
      thumbnail,        // Thumbnail URL
      liveInput,        // Live input UID this recording is from
      status,           // { state: 'ready' | 'error' | 'inprogress' }
      meta,             // Custom metadata we set
    } = body;

    if (!uid) {
      logStep("No video UID in payload, ignoring");
      return new Response(JSON.stringify({ success: true, message: "No UID" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const liveInputUid = typeof liveInput === 'string' ? liveInput : liveInput?.uid;
    const statusState = typeof status === 'string' ? status : status?.state;
    
    logStep("Processing video", { uid, liveInputUid, statusState, readyToStream, duration });

    // Look for recordings with pending status for this stream
    const { data: pendingRecordings, error: findError } = await supabaseClient
      .from('recordings')
      .select('id, video_url, live_id')
      .or(`video_url.eq.pending:${liveInputUid},video_url.eq.${uid}`);

    if (findError) {
      logStep("Error finding pending recordings", findError);
    }

    if (pendingRecordings && pendingRecordings.length > 0) {
      for (const recording of pendingRecordings) {
        const currentVideoUrl = recording.video_url ?? '';
        const hasLocalBackup = currentVideoUrl.startsWith('storage:');

        // Only update if the video is ready
        if (readyToStream || statusState === 'ready') {
          // IMPORTANT:
          // If we already uploaded a guaranteed local backup to Storage (storage:...),
          // DO NOT overwrite it with Cloudflare UID. Cloudflare VOD might still be processing
          // or may never become ready (codec issues). This was causing the UI to get stuck
          // on “Procesando grabación…”.
          const updateData: any = {};

          if (!hasLocalBackup) {
            updateData.video_url = uid; // Store Cloudflare video UID
          }
          
          if (duration && duration > 0) {
            updateData.duration = Math.floor(duration);
          }
          
          if (thumbnail) {
            updateData.thumbnail_url = thumbnail;
          }

          // If there's nothing to update (e.g., local backup exists and no duration/thumbnail), skip.
          if (Object.keys(updateData).length === 0) {
            logStep('Recording already has local backup, skipping update', {
              recordingId: recording.id,
              uid,
            });
            continue;
          }

          const { error: updateError } = await supabaseClient
            .from('recordings')
            .update(updateData)
            .eq('id', recording.id);

          if (updateError) {
            logStep("Error updating recording", { recordingId: recording.id, error: updateError });
          } else {
            logStep("Recording updated successfully", { recordingId: recording.id, uid, hasLocalBackup });
          }
        } else if (statusState === 'error') {
          logStep("Video processing failed", { uid, recordingId: recording.id });
          // Leave as pending - the local backup should handle this case
        }
      }
    } else {
      logStep("No pending recordings found for this stream", { liveInputUid, uid });
      
      // Try to find by live_id in metadata
      if (meta?.liveId) {
        const { data: liveRecording } = await supabaseClient
          .from('recordings')
          .select('id, video_url')
          .eq('live_id', meta.liveId)
          .single();

        if (liveRecording) {
          const currentVideoUrl = liveRecording.video_url ?? '';
          const hasLocalBackup = currentVideoUrl.startsWith('storage:');

          const updateData: any = {};
          if (!hasLocalBackup) {
            updateData.video_url = uid;
          }
          if (duration) updateData.duration = Math.floor(duration);
          if (thumbnail) updateData.thumbnail_url = thumbnail;

          if (Object.keys(updateData).length === 0) {
            logStep('Recording already has local backup, skipping update via liveId', {
              recordingId: liveRecording.id,
              uid,
            });
          } else {

            await supabaseClient
              .from('recordings')
              .update(updateData)
              .eq('id', liveRecording.id);

            logStep("Updated recording via liveId metadata", { recordingId: liveRecording.id, hasLocalBackup });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
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
