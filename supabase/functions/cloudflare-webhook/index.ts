import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, cf-webhook-auth",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CLOUDFLARE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

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
        // Only update if the video is ready
        if (readyToStream || statusState === 'ready') {
          const updateData: any = {
            video_url: uid, // Store Cloudflare video UID
          };
          
          if (duration && duration > 0) {
            updateData.duration = Math.floor(duration);
          }
          
          if (thumbnail) {
            updateData.thumbnail_url = thumbnail;
          }

          const { error: updateError } = await supabaseClient
            .from('recordings')
            .update(updateData)
            .eq('id', recording.id);

          if (updateError) {
            logStep("Error updating recording", { recordingId: recording.id, error: updateError });
          } else {
            logStep("Recording updated successfully", { recordingId: recording.id, uid });
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
          .select('id')
          .eq('live_id', meta.liveId)
          .single();

        if (liveRecording) {
          const updateData: any = { video_url: uid };
          if (duration) updateData.duration = Math.floor(duration);
          if (thumbnail) updateData.thumbnail_url = thumbnail;

          await supabaseClient
            .from('recordings')
            .update(updateData)
            .eq('id', liveRecording.id);

          logStep("Updated recording via liveId metadata", { recordingId: liveRecording.id });
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
