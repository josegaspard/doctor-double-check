import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[DAILY-WEBHOOK] ${step}${detailsStr}`);
};

// Helper function to find a live by room name
async function findLiveByRoomName(supabaseClient: any, roomName: string) {
  if (!roomName) return null;

  // First try direct match on daily_room_name
  const { data: directMatch } = await supabaseClient
    .from('lives')
    .select('*')
    .eq('daily_room_name', roomName)
    .limit(1);

  if (directMatch && directMatch.length > 0) {
    return directMatch[0];
  }

  // Fallback: parse liveId from room name pattern: live-{liveId.slice(0,8)}-{timestamp}
  const liveIdPrefix = roomName?.split('-')[1];
  if (liveIdPrefix) {
    const { data: prefixMatch } = await supabaseClient
      .from('lives')
      .select('*')
      .ilike('id', `${liveIdPrefix}%`)
      .limit(1);

    if (prefixMatch && prefixMatch.length > 0) {
      return prefixMatch[0];
    }
  }

  return null;
}

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

    const payload = await req.json();
    const eventType = payload.event;
    logStep("Event type", { eventType });

    // Handle different Daily.co webhook events
    switch (eventType) {
      case "recording.started": {
        const roomName = payload.room_name;
        logStep("Recording started", { roomName });

        const live = await findLiveByRoomName(supabaseClient, roomName);
        if (live) {
          logStep("Found live for recording.started", { liveId: live.id });
        }
        break;
      }

      case "recording.stopped": {
        const roomName = payload.room_name;
        const recordingId = payload.recording_id;
        logStep("Recording stopped", { roomName, recordingId });

        const live = await findLiveByRoomName(supabaseClient, roomName);
        if (live) {
          await supabaseClient
            .from('lives')
            .update({ status: 'processing_recording' })
            .eq('id', live.id);
          logStep("Updated live to processing_recording", { liveId: live.id });
        }
        break;
      }

      case "recording.ready-to-download": {
        const roomName = payload.room_name;
        const recordingId = payload.recording_id;
        const downloadLink = payload.download_link;
        const duration = payload.duration || 0;
        
        logStep("Recording ready", { roomName, recordingId, duration, downloadLink });

        const live = await findLiveByRoomName(supabaseClient, roomName);
        if (live) {
          // Update live status
          await supabaseClient
            .from('lives')
            .update({ status: 'recording_ready' })
            .eq('id', live.id);

          // Check if recording already exists
          const { data: existingRecording } = await supabaseClient
            .from('recordings')
            .select('id')
            .eq('live_id', live.id)
            .maybeSingle();

          if (!existingRecording) {
            // Create recording entry
            await supabaseClient
              .from('recordings')
              .insert({
                live_id: live.id,
                doctor_id: live.doctor_id,
                title: live.title,
                description: live.description,
                specialty: live.specialty,
                tags: live.tags,
                duration: Math.ceil(duration / 60), // Convert seconds to minutes
                price: live.recording_price || 99,
                video_url: downloadLink,
                thumbnail_url: live.thumbnail_url,
              });
            logStep("Recording created", { liveId: live.id });
          } else {
            // Update existing recording with video URL
            await supabaseClient
              .from('recordings')
              .update({ video_url: downloadLink })
              .eq('id', existingRecording.id);
            logStep("Recording updated with video URL", { recordingId: existingRecording.id });
          }
        }
        break;
      }

      case "participant.joined": {
        const roomName = payload.room_name;
        const isOwner = payload.participant?.is_owner || false;
        logStep("Participant joined", { roomName, isOwner });

        if (!isOwner) {
          const live = await findLiveByRoomName(supabaseClient, roomName);
          if (live && live.status === 'live') {
            await supabaseClient
              .from('lives')
              .update({ viewer_count: (live.viewer_count || 0) + 1 })
              .eq('id', live.id);
          }
        }
        break;
      }

      case "participant.left": {
        const roomName = payload.room_name;
        const isOwner = payload.participant?.is_owner || false;
        logStep("Participant left", { roomName, isOwner });

        if (!isOwner) {
          const live = await findLiveByRoomName(supabaseClient, roomName);
          if (live && live.status === 'live') {
            const newCount = Math.max(0, (live.viewer_count || 1) - 1);
            await supabaseClient
              .from('lives')
              .update({ viewer_count: newCount })
              .eq('id', live.id);
          }
        }
        break;
      }

      default:
        logStep("Unhandled event type", { eventType });
    }

    return new Response(
      JSON.stringify({ success: true, event: eventType }),
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
