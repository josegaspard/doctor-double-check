// Admin tooling: lists Daily.co recordings, attempts to match each against a live row,
// and re-downloads the bytes into Supabase Storage. POST mode=list returns inventory;
// mode=recover&recording_id=<id> persists one recording.
import { createClient } from "npm:@supabase/supabase-js@2";

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
    const dailyApiKey = Deno.env.get("DAILY_API_KEY");
    if (!dailyApiKey) throw new Error("DAILY_API_KEY missing");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const mode = body.mode || 'list';

    if (mode === 'list') {
      const allRecordings: any[] = [];
      let next: string | null = null;
      // paginate
      for (let i = 0; i < 10; i++) {
        const url = `https://api.daily.co/v1/recordings?limit=100${next ? `&starting_after=${next}` : ''}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${dailyApiKey}` } });
        if (!res.ok) {
          const errText = await res.text();
          return new Response(JSON.stringify({ error: 'daily-list-failed', status: res.status, detail: errText }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const data = await res.json();
        const items = data.data || [];
        allRecordings.push(...items);
        if (items.length < 100) break;
        next = items[items.length - 1].id;
      }

      // Cross-reference with lives + recordings tables
      const { data: lives } = await supabaseAdmin
        .from('lives')
        .select('id, title, doctor_id, daily_room_name, started_at, recording_price');
      const { data: recordings } = await supabaseAdmin
        .from('recordings')
        .select('id, live_id, video_url, title');

      const liveByRoom = new Map((lives || []).map((l: any) => [l.daily_room_name, l]));
      const recByLive = new Map((recordings || []).map((r: any) => [r.live_id, r]));

      const inventory = allRecordings.map((rec: any) => {
        const live = liveByRoom.get(rec.room_name);
        const existingRec = live ? recByLive.get(live.id) : null;
        return {
          recording_id: rec.id,
          room_name: rec.room_name,
          duration_s: rec.duration,
          start_ts: rec.start_ts,
          status: rec.status,
          matched_live_id: live?.id || null,
          matched_live_title: live?.title || null,
          existing_recording_row: existingRec ? {
            id: existingRec.id,
            video_url_kind: existingRec.video_url?.startsWith('storage:') ? 'storage' : (existingRec.video_url ? 'expired/external' : 'null')
          } : null,
        };
      });

      return new Response(JSON.stringify({
        total: allRecordings.length,
        inventory,
        unmatched: inventory.filter(i => !i.matched_live_id).length,
        matched_no_storage: inventory.filter(i => i.matched_live_id && (!i.existing_recording_row || i.existing_recording_row.video_url_kind !== 'storage')).length,
      }, null, 2), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (mode === 'recover') {
      const recordingId = body.recording_id;
      if (!recordingId) throw new Error('recording_id required');

      const linkRes = await fetch(`https://api.daily.co/v1/recordings/${recordingId}/access-link`, {
        headers: { Authorization: `Bearer ${dailyApiKey}` },
      });
      if (!linkRes.ok) {
        return new Response(JSON.stringify({ error: 'access-link failed', detail: await linkRes.text() }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { download_link } = await linkRes.json();

      const recRes = await fetch(`https://api.daily.co/v1/recordings/${recordingId}`, {
        headers: { Authorization: `Bearer ${dailyApiKey}` },
      });
      const recMeta = await recRes.json();
      const roomName = recMeta.room_name;
      const duration = recMeta.duration || 0;

      const { data: liveMatch } = await supabaseAdmin
        .from('lives')
        .select('*')
        .eq('daily_room_name', roomName)
        .maybeSingle();

      if (!liveMatch) {
        return new Response(JSON.stringify({ error: 'no live matches room_name', room_name: roomName }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const videoRes = await fetch(download_link);
      if (!videoRes.ok) throw new Error(`Failed to download Daily recording: ${videoRes.status}`);
      const buf = await videoRes.arrayBuffer();
      const sizeMB = (buf.byteLength / 1024 / 1024).toFixed(2);
      const filename = `${liveMatch.id}-${recordingId}.mp4`;
      const storagePath = `${liveMatch.doctor_id}/${filename}`;

      const { error: upErr } = await supabaseAdmin.storage
        .from('recordings')
        .upload(storagePath, new Uint8Array(buf), {
          contentType: 'video/mp4',
          upsert: true,
        });
      if (upErr) {
        return new Response(JSON.stringify({ error: 'storage upload failed', detail: upErr.message, sizeMB }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const persistedRef = `storage:${storagePath}`;

      const { data: existing } = await supabaseAdmin
        .from('recordings')
        .select('id')
        .eq('live_id', liveMatch.id)
        .maybeSingle();

      let recordingRowId: string;
      if (existing) {
        await supabaseAdmin
          .from('recordings')
          .update({ video_url: persistedRef, duration: Math.ceil(duration / 60) })
          .eq('id', existing.id);
        recordingRowId = existing.id;
      } else {
        const { data: inserted } = await supabaseAdmin
          .from('recordings')
          .insert({
            live_id: liveMatch.id,
            doctor_id: liveMatch.doctor_id,
            title: liveMatch.title,
            description: liveMatch.description,
            specialty: liveMatch.specialty,
            tags: liveMatch.tags,
            duration: Math.ceil(duration / 60),
            price: liveMatch.recording_price || 0,
            video_url: persistedRef,
            thumbnail_url: liveMatch.thumbnail_url,
          })
          .select('id')
          .single();
        recordingRowId = inserted!.id;
      }

      await supabaseAdmin
        .from('lives')
        .update({ status: 'recording_ready' })
        .eq('id', liveMatch.id);

      return new Response(JSON.stringify({
        ok: true,
        recordingRowId,
        liveId: liveMatch.id,
        title: liveMatch.title,
        sizeMB,
        storagePath,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'unknown mode', mode }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
