import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[END-DAILY-ROOM] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const dailyApiKey = Deno.env.get("DAILY_API_KEY");
    if (!dailyApiKey) {
      throw new Error("DAILY_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    // Client for auth check
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    
    // Service client for database operations (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("User not authenticated");

    const userId = userData.user.id;
    logStep("User authenticated", { userId });

    // Parse request body
    const { liveId, roomName, saveRecording = false } = await req.json();

    // If no liveId, this is a consultation-only room deletion.
    // Verify caller owns the consultation (was patient or doctor) before
    // deleting — otherwise anyone with a leaked roomName could nuke calls.
    if (!liveId) {
      logStep("Consultation-only room deletion", { roomName });

      if (!roomName) {
        return new Response(
          JSON.stringify({ success: false, error: "roomName required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: consult } = await supabaseAdmin
        .from("consultations")
        .select("id, patient_id, doctor_id")
        .eq("video_room_name", roomName)
        .maybeSingle();

      if (!consult) {
        return new Response(
          JSON.stringify({ success: false, error: "Consultation not found for this room" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (consult.patient_id !== userId && consult.doctor_id !== userId) {
        return new Response(
          JSON.stringify({ success: false, error: "Not a participant in this consultation" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        const deleteResponse = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${dailyApiKey}` },
        });
        if (deleteResponse.ok) {
          logStep("Daily.co room deleted (consultation)", { roomName });
        } else {
          logStep("Warning: Could not delete room", { roomName });
        }
      } catch (roomError) {
        logStep("Warning: Error deleting room", { error: String(roomError) });
      }

      // Clear room fields on the consultation so the waiting banner disappears
      await supabaseAdmin
        .from("consultations")
        .update({ video_room_name: null, video_room_url: null })
        .eq("id", consult.id);

      return new Response(
        JSON.stringify({ success: true, status: "ended" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    logStep("Ending live", { liveId, roomName, saveRecording });

    // Verify user owns this live
    const { data: live, error: liveError } = await supabaseAdmin
      .from("lives")
      .select("*")
      .eq("id", liveId)
      .single();

    if (liveError || !live) {
      throw new Error("Live not found");
    }

    if (live.doctor_id !== userId) {
      throw new Error("User is not the owner of this live");
    }

    logStep("Live verified", { doctorId: live.doctor_id, status: live.status });

    // Delete the Daily.co room if roomName provided
    if (roomName) {
      try {
        const deleteResponse = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${dailyApiKey}`,
          },
        });

        if (deleteResponse.ok) {
          logStep("Daily.co room deleted", { roomName });
        } else {
          const errorText = await deleteResponse.text();
          logStep("Warning: Could not delete room", { roomName, error: errorText });
        }
      } catch (roomError) {
        logStep("Warning: Error deleting room", { error: String(roomError) });
      }
    }

    // Get recordings from Daily.co if saving is enabled.
    // Daily's access-link is a temporary signed URL (~120s TTL) — we must download
    // the bytes immediately and persist them to Supabase Storage. Otherwise the
    // recordings.video_url goes stale and playback breaks for users.
    let recordingUrl: string | null = null;
    let recordingDuration = 0;

    if (saveRecording && roomName) {
      try {
        logStep("Checking for recordings", { roomName });

        const recordingsResponse = await fetch(
          `https://api.daily.co/v1/recordings?room_name=${roomName}`,
          {
            headers: {
              "Authorization": `Bearer ${dailyApiKey}`,
            },
          }
        );

        if (recordingsResponse.ok) {
          const recordingsData = await recordingsResponse.json();
          const recordingsCount = recordingsData.data?.length || 0;
          logStep("Recordings fetched", { count: recordingsCount });

          if (recordingsData.data && recordingsData.data.length > 0) {
            const latestRecording = recordingsData.data[0];
            recordingDuration = Math.round(latestRecording.duration || 0);

            const downloadResponse = await fetch(
              `https://api.daily.co/v1/recordings/${latestRecording.id}/access-link`,
              {
                headers: {
                  "Authorization": `Bearer ${dailyApiKey}`,
                },
              }
            );

            if (downloadResponse.ok) {
              const downloadData = await downloadResponse.json();
              const tempLink = downloadData.download_link as string;
              logStep("Got temp link, downloading bytes", { duration: recordingDuration });

              try {
                const videoRes = await fetch(tempLink);
                if (videoRes.ok) {
                  const buf = await videoRes.arrayBuffer();
                  const sizeMB = (buf.byteLength / 1024 / 1024).toFixed(2);
                  const filename = `${liveId}-${Date.now()}.mp4`;
                  const storagePath = `${live.doctor_id}/${filename}`;
                  const { error: upErr } = await supabaseAdmin.storage
                    .from('recordings')
                    .upload(storagePath, new Uint8Array(buf), {
                      contentType: 'video/mp4',
                      upsert: true,
                    });
                  if (upErr) {
                    logStep("Storage upload failed", { error: upErr.message, sizeMB });
                  } else {
                    recordingUrl = `storage:${storagePath}`;
                    logStep("Recording persisted to Storage", { storagePath, sizeMB });
                  }
                } else {
                  logStep("Failed to fetch video bytes", { status: videoRes.status });
                }
              } catch (e) {
                logStep("Error downloading/uploading video", { error: String(e) });
              }
            } else {
              logStep("Could not get recording access link");
            }
          } else {
            logStep("No recordings found for this room");
          }
        } else {
          const errorText = await recordingsResponse.text();
          logStep("Could not fetch recordings", { error: errorText });
        }
      } catch (recError) {
        logStep("Warning: Error fetching recordings", { error: String(recError) });
      }
    }

    // Calculate duration from start time
    const startedAt = new Date(live.started_at);
    const endedAt = new Date();
    const durationMinutes = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000);

    // Update live status
    const newStatus = saveRecording ? (recordingUrl ? "recording_ready" : "processing_recording") : "ended";
    const { error: updateError } = await supabaseAdmin
      .from("lives")
      .update({
        status: newStatus,
        ended_at: endedAt.toISOString(),
        viewer_count: 0, // Reset viewer count
      })
      .eq("id", liveId);

    if (updateError) {
      logStep("Error updating live status", { error: updateError.message });
      throw new Error("Failed to update live status");
    }

    logStep("Live status updated", { newStatus, durationMinutes });

    // Create recording entry if saving is enabled
    let recordingId: string | null = null;
    if (saveRecording) {
      const { data: newRecording, error: recordingError } = await supabaseAdmin
        .from("recordings")
        .insert({
          doctor_id: live.doctor_id,
          live_id: liveId,
          title: live.title,
          description: live.description,
          specialty: live.specialty,
          tags: live.tags || [],
          thumbnail_url: live.thumbnail_url,
          video_url: recordingUrl, // May be null if recording not available
          duration: recordingDuration || durationMinutes, // Use calculated duration if no recording
          price: live.recording_price || 0,
        })
        .select("id")
        .single();

      if (recordingError) {
        logStep("Warning: Error creating recording", { error: recordingError.message });
      } else {
        recordingId = newRecording.id;
        logStep("Recording created", { recordingId, hasVideoUrl: !!recordingUrl });

        // Update live status to recording_ready
        await supabaseAdmin
          .from("lives")
          .update({ status: "recording_ready" })
          .eq("id", liveId);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        liveId,
        status: newStatus,
        recordingId,
        hasRecording: !!recordingUrl,
        durationMinutes,
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
