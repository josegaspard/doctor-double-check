import { createClient } from "npm:@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[DAILY-WEBHOOK] ${step}${detailsStr}`);
};

async function findLiveByRoomName(supabaseClient: any, roomName: string) {
  if (!roomName) return null;

  const { data: directMatch } = await supabaseClient
    .from('lives')
    .select('*')
    .eq('daily_room_name', roomName)
    .limit(1);

  if (directMatch && directMatch.length > 0) {
    return directMatch[0];
  }

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

// Downloads Daily.co recording from temp signed URL and uploads to Supabase Storage.
// Returns a permanent storage ref like "storage:<doctorId>/<liveId>-<ts>.mp4" or null on failure.
async function downloadAndPersistRecording(
  supabaseClient: any,
  downloadLink: string,
  doctorId: string,
  liveId: string,
): Promise<string | null> {
  try {
    // SECURITY: SSRF allowlist. download_link arrives in a verified Daily
    // webhook payload but we still pin the host so a compromised Daily
    // payload (or a future bug that skips sig verification) can't redirect
    // us to fetch internal services.
    const u = new URL(downloadLink);
    const allowedHosts = ['daily.co', 'daily-recordings.s3.amazonaws.com'];
    const hostOk = allowedHosts.some(h => u.hostname === h || u.hostname.endsWith('.' + h));
    if (u.protocol !== 'https:' || !hostOk) {
      logStep("Refused download — host not in allowlist", { host: u.hostname });
      return null;
    }
    logStep("Downloading Daily.co recording", { liveId });
    const res = await fetch(downloadLink);
    if (!res.ok) {
      logStep("Download failed", { status: res.status });
      return null;
    }
    const arrayBuffer = await res.arrayBuffer();
    const sizeMB = (arrayBuffer.byteLength / 1024 / 1024).toFixed(2);
    logStep("Download complete", { sizeMB });

    const filename = `${liveId}-${Date.now()}.mp4`;
    const storagePath = `${doctorId}/${filename}`;

    const { error: uploadError } = await supabaseClient.storage
      .from('recordings')
      .upload(storagePath, new Uint8Array(arrayBuffer), {
        contentType: 'video/mp4',
        upsert: true,
      });

    if (uploadError) {
      logStep("Upload to Storage failed", { error: uploadError.message, sizeMB });
      return null;
    }

    logStep("Uploaded to Storage", { storagePath, sizeMB });
    return `storage:${storagePath}`;
  } catch (err) {
    logStep("downloadAndPersistRecording error", { error: String(err) });
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    const dailyWebhookSecret = Deno.env.get("DAILY_WEBHOOK_SECRET");
    const dailySignature = req.headers.get("x-webhook-signature");
    const rawBody = await req.text();

    // SECURITY: fail-closed. Previously fell through to "skip verification"
    // when DAILY_WEBHOOK_SECRET was unset, which let an attacker forge
    // recording-ready events (and ride the function's service-role outbound
    // fetch to download_link → SSRF).
    if (!dailyWebhookSecret) {
      logStep("DAILY_WEBHOOK_SECRET not configured — rejecting");
      return new Response("Server not configured", { status: 500, headers: corsHeaders });
    }
    let valid = false;
    if (dailySignature) {
      const parts = Object.fromEntries(
        dailySignature.split(",").map((p) => {
          const idx = p.indexOf("=");
          return idx > 0 ? [p.slice(0, idx).trim(), p.slice(idx + 1).trim()] : [p, ""];
        })
      );
      const t = parts.t;
      const v1 = parts.v1;
      if (t && v1) {
        const expected = createHmac("sha256", dailyWebhookSecret)
          .update(`${t}.${rawBody}`)
          .digest("hex");
        // constant-time compare
        if (expected.length === v1.length) {
          let diff = 0;
          for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
          if (diff === 0) valid = true;
        }
      }
      if (!valid) {
        const legacy = createHmac("sha256", dailyWebhookSecret).update(rawBody).digest("hex");
        if (legacy.length === dailySignature.length) {
          let diff = 0;
          for (let i = 0; i < legacy.length; i++) diff |= legacy.charCodeAt(i) ^ dailySignature.charCodeAt(i);
          if (diff === 0) valid = true;
        }
      }
    }
    if (!valid) {
      logStep("Unauthorized: invalid or missing Daily webhook signature");
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const payload = JSON.parse(rawBody);
    const eventType = payload.event;
    logStep("Event type", { eventType });

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

        logStep("Recording ready", { roomName, recordingId, duration });

        const live = await findLiveByRoomName(supabaseClient, roomName);
        if (!live) {
          logStep("No matching live found for recording.ready-to-download");
          break;
        }

        // Download from Daily (URL expires in ~120s) and persist to Supabase Storage
        const persistedRef = downloadLink
          ? await downloadAndPersistRecording(supabaseClient, downloadLink, live.doctor_id, live.id)
          : null;

        if (!persistedRef) {
          logStep("Failed to persist recording — leaving live in processing state");
          await supabaseClient
            .from('lives')
            .update({ status: 'recording_failed' })
            .eq('id', live.id);
          break;
        }

        await supabaseClient
          .from('lives')
          .update({ status: 'recording_ready' })
          .eq('id', live.id);

        const { data: existingRecording } = await supabaseClient
          .from('recordings')
          .select('id')
          .eq('live_id', live.id)
          .maybeSingle();

        if (!existingRecording) {
          await supabaseClient
            .from('recordings')
            .insert({
              live_id: live.id,
              doctor_id: live.doctor_id,
              title: live.title,
              description: live.description,
              specialty: live.specialty,
              tags: live.tags,
              duration: Math.ceil(duration / 60),
              price: live.recording_price || 0,
              video_url: persistedRef,
              thumbnail_url: live.thumbnail_url,
            });
          logStep("Recording row created with permanent URL", { liveId: live.id });
        } else {
          await supabaseClient
            .from('recordings')
            .update({ video_url: persistedRef, duration: Math.ceil(duration / 60) })
            .eq('id', existingRecording.id);
          logStep("Recording row updated with permanent URL", { recordingId: existingRecording.id });
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
