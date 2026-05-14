// Server-side recording row creation. Frontend uploads the video blob to Storage
// directly (which works under user RLS), then calls this function to create the
// recordings row using service role. Bypasses any silent RLS quirks on the INSERT
// path that were leaving recordings invisible after a successful Storage upload.
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
      return new Response(JSON.stringify({ error: "unauthorized", detail: userErr?.message }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const {
      liveId, storagePath, backend, duration, price = 0,
      title, description, specialty, tags = [], thumbnailUrl,
      bunnyStatus,
    } = body || {};

    // backend === 'bunny' means the upload landed in Bunny Stream (newest flow,
    // HLS adaptive). backend === 'b2' means Backblaze (mp4 progressive).
    // Anything else falls back to legacy Supabase Storage.
    const isBunny = backend === 'bunny';
    const isB2 = backend === 'b2';

    if (!liveId || !storagePath) {
      return new Response(JSON.stringify({ error: "liveId and storagePath required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the live belongs to the caller
    const { data: live, error: liveErr } = await admin
      .from("lives")
      .select("id, doctor_id, title, description, specialty, tags, recording_price, thumbnail_url")
      .eq("id", liveId)
      .single();
    if (liveErr || !live) {
      return new Response(JSON.stringify({ error: "live not found", liveId }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (live.doctor_id !== user.id) {
      return new Response(JSON.stringify({ error: "not the live owner" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sanity-check the storage path is under the doctor's namespace.
    // Bunny videos use the videoId (GUID) directly, no namespace prefix.
    if (!isBunny && !storagePath.startsWith(`${user.id}/`)) {
      return new Response(JSON.stringify({ error: "storagePath outside your namespace" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Confirm the file exists. Supabase Storage → list+match; B2/Bunny → trust
    // the upload PUT 200 because the presigned/library flow already validated.
    if (!isB2 && !isBunny) {
      const { data: head } = await admin.storage.from("recordings").list(user.id, {
        limit: 100,
        search: storagePath.split("/").pop(),
      });
      const fileExists = (head || []).some((f: any) => `${user.id}/${f.name}` === storagePath);
      if (!fileExists) {
        return new Response(JSON.stringify({ error: "file not found in storage", storagePath }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const videoRef = isBunny
      ? `bunny:${storagePath}`
      : isB2
        ? `b2:${storagePath}`
        : `storage:${storagePath}`;

    // Upsert: if a recording row already exists for this live, update it
    const { data: existing } = await admin
      .from("recordings")
      .select("id")
      .eq("live_id", liveId)
      .maybeSingle();

    let recordingId: string;
    // bunnyStatus default 'uploading' — el frontend lo manda 'uploading' cuando
    // crea la row antes de que termine el TUS upload (paralelización para que
    // el doctor vea su grabación instantáneamente). El webhook de Bunny lo
    // cambia a 'ready' o 'failed' cuando termina el encoding.
    const allowedBunnyStatuses = ['uploading', 'processing', 'ready', 'failed'];
    const finalBunnyStatus = bunnyStatus && allowedBunnyStatuses.includes(bunnyStatus)
      ? bunnyStatus
      : 'uploading';
    const bunnyFields = isBunny
      ? { bunny_video_id: storagePath, bunny_status: finalBunnyStatus }
      : {};
    if (existing) {
      const { error: updErr } = await admin
        .from("recordings")
        .update({
          video_url: videoRef,
          duration,
          price,
          thumbnail_url: thumbnailUrl ?? live.thumbnail_url,
          ...bunnyFields,
        })
        .eq("id", existing.id);
      if (updErr) throw updErr;
      recordingId = existing.id;
    } else {
      const { data: inserted, error: insErr } = await admin
        .from("recordings")
        .insert({
          live_id: liveId,
          doctor_id: user.id,
          title: title ?? live.title,
          description: description ?? live.description,
          specialty: specialty ?? live.specialty,
          tags: tags?.length ? tags : (live.tags || []),
          duration,
          price: price ?? live.recording_price ?? 0,
          video_url: videoRef,
          thumbnail_url: thumbnailUrl ?? live.thumbnail_url,
          ...bunnyFields,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;
      recordingId = inserted.id;
    }

    // Mark the live as recording_ready
    await admin.from("lives").update({ status: "recording_ready" }).eq("id", liveId);

    return new Response(JSON.stringify({ ok: true, recordingId, videoRef }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
