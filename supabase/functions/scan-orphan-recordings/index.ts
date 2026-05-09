// Auto-recovery: scans the authenticated doctor's recordings/<doctorId>/* folder,
// finds video files that don't have a matching recordings row, and creates rows
// for them by inferring liveId from the filename pattern <liveId>-<ts>.<ext>.
// Returns { scanned, recovered, orphanedFiles } so the UI can surface what happened.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // 1. List all video files in recordings/<userId>/
    const { data: files, error: listErr } = await admin.storage
      .from("recordings")
      .list(user.id, { limit: 200 });
    if (listErr) throw listErr;

    const videos = (files || []).filter((f: any) =>
      /\.(mp4|webm|mov)$/i.test(f.name) && f.name && !f.name.endsWith("/")
    );

    // 2. Existing recordings for this doctor
    const { data: existing } = await admin
      .from("recordings")
      .select("id, video_url, live_id")
      .eq("doctor_id", user.id);

    const existingPaths = new Set<string>();
    (existing || []).forEach((r: any) => {
      if (r.video_url?.startsWith("storage:")) {
        existingPaths.add(r.video_url.replace(/^storage:/, ""));
      }
    });
    const existingByLive = new Map((existing || []).map((r: any) => [r.live_id, r]));

    // 3. For each video file, check if it has a row
    const orphaned: any[] = [];
    let recovered = 0;

    for (const f of videos) {
      const fullPath = `${user.id}/${f.name}`;
      if (existingPaths.has(fullPath)) continue; // already linked

      // Filename format: <liveId>-<timestamp>.<ext>
      const match = f.name.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
      if (!match) {
        orphaned.push({ file: fullPath, reason: "cannot parse liveId from filename" });
        continue;
      }
      const liveId = match[1];

      // Verify live exists and belongs to user
      const { data: live } = await admin
        .from("lives")
        .select("id, doctor_id, title, description, specialty, tags, recording_price, thumbnail_url, started_at, ended_at")
        .eq("id", liveId)
        .maybeSingle();
      if (!live) {
        orphaned.push({ file: fullPath, reason: "live not found", liveId });
        continue;
      }
      if (live.doctor_id !== user.id) {
        orphaned.push({ file: fullPath, reason: "live owned by another doctor", liveId });
        continue;
      }

      // If a row already exists for this live but with a different storage path, update it.
      const existingRow = existingByLive.get(liveId);
      const durationMin = live.ended_at && live.started_at
        ? Math.max(1, Math.ceil((new Date(live.ended_at).getTime() - new Date(live.started_at).getTime()) / 60000))
        : 1;

      if (existingRow) {
        await admin
          .from("recordings")
          .update({ video_url: `storage:${fullPath}`, duration: durationMin })
          .eq("id", existingRow.id);
        recovered++;
        continue;
      }

      const { error: insErr } = await admin.from("recordings").insert({
        live_id: liveId,
        doctor_id: user.id,
        title: live.title,
        description: live.description,
        specialty: live.specialty,
        tags: live.tags || [],
        duration: durationMin,
        price: live.recording_price ?? 0,
        video_url: `storage:${fullPath}`,
        thumbnail_url: live.thumbnail_url,
      });
      if (insErr) {
        orphaned.push({ file: fullPath, reason: `insert failed: ${insErr.message}`, liveId });
        continue;
      }

      await admin.from("lives").update({ status: "recording_ready" }).eq("id", liveId);
      recovered++;
    }

    return new Response(JSON.stringify({
      scanned: videos.length,
      recovered,
      orphanedFiles: orphaned,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
