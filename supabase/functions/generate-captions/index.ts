import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const LIBRARY_ID = Deno.env.get('BUNNY_STREAM_LIBRARY_ID');
const API_KEY = Deno.env.get('BUNNY_STREAM_API_KEY');

// Idiomas de la app (i18n.ts SupportedLanguage). ISO 639-1 — los que Bunny
// (motor Whisper) usa como source/target para transcribir + traducir.
const APP_LANGUAGES = ['es', 'en', 'pt', 'fr', 'it', 'de', 'ca', 'zh'];
const DEFAULT_SOURCE = 'es';

// Extrae el GUID de Bunny. En este proyecto el video vive en recordings como
// bunny_video_id (columna) o embebido en video_url con prefijo 'bunny:'.
function resolveBunnyId(rec: { bunny_video_id?: string | null; video_url?: string | null }) {
  if (rec.bunny_video_id) return rec.bunny_video_id;
  if (rec.video_url?.startsWith('bunny:')) return rec.video_url.slice('bunny:'.length);
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    if (!LIBRARY_ID || !API_KEY) return json({ error: 'bunny_not_configured' }, 500);

    const auth = req.headers.get('authorization');
    if (!auth) return json({ error: 'unauthorized' }, 401);

    // Identidad del llamador con su propio JWT.
    const supa = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return json({ error: 'unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const { recordingId } = body;
    if (!recordingId || typeof recordingId !== 'string')
      return json({ error: 'recordingId_required' }, 400);

    // sourceLanguage opcional; si no es un idioma de la app, cae al default.
    const sourceLanguage: string =
      typeof body.sourceLanguage === 'string' && APP_LANGUAGES.includes(body.sourceLanguage)
        ? body.sourceLanguage
        : DEFAULT_SOURCE;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: rec } = await admin
      .from('recordings')
      .select('id, doctor_id, bunny_video_id, video_url, bunny_status')
      .eq('id', recordingId)
      .maybeSingle();
    if (!rec) return json({ error: 'recording_not_found' }, 404);

    // Entitlement: solo el DUEÑO de la grabación o un admin.
    const isOwner = rec.doctor_id === user.id;
    let allowed = isOwner;
    if (!allowed) {
      const { data: isAdmin } = await admin.rpc('has_role', { _user_id: user.id, _role: 'admin' });
      allowed = isAdmin === true;
    }
    if (!allowed) return json({ error: 'forbidden' }, 403);

    const videoId = resolveBunnyId(rec);
    if (!videoId) return json({ error: 'not_a_bunny_video' }, 409);

    // Estado REAL en Bunny — la columna recordings.bunny_status puede quedar
    // desactualizada si el webhook no corrió (visto en prod: DB='processing'
    // pero Bunny status=4 Finished). Bunny: 4 = Finished (listo para transcribir).
    const infoRes = await fetch(
      `https://video.bunnycdn.com/library/${LIBRARY_ID}/videos/${videoId}`,
      { headers: { 'AccessKey': API_KEY, 'Accept': 'application/json' } },
    );
    if (!infoRes.ok) {
      console.error('[generate-captions] bunny info failed:', infoRes.status, await infoRes.text());
      return json({ error: 'bunny_video_not_found', status: infoRes.status }, 404);
    }
    const info = await infoRes.json();
    if (info.status !== 4)
      return json({ error: 'video_not_ready', bunny_status_code: info.status }, 409);

    // Objetivos = los 8 idiomas de la app menos el idioma fuente (ese lo genera
    // Bunny automáticamente al transcribir).
    const targetLanguages = APP_LANGUAGES.filter((l) => l !== sourceLanguage);

    // Bunny Stream — Transcribe Video: genera captions en el idioma fuente y los
    // TRADUCE a targetLanguages en una sola operación (async del lado de Bunny).
    // force=true regenera si ya existían.
    const bunnyRes = await fetch(
      `https://video.bunnycdn.com/library/${LIBRARY_ID}/videos/${videoId}/transcribe?force=true`,
      {
        method: 'POST',
        headers: {
          'AccessKey': API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ sourceLanguage, targetLanguages }),
      },
    );

    if (!bunnyRes.ok) {
      const detail = await bunnyRes.text();
      console.error('[generate-captions] bunny transcribe failed:', bunnyRes.status, detail);
      await admin.from('recordings').update({
        captions_status: 'failed',
        captions_updated_at: new Date().toISOString(),
      }).eq('id', recordingId);
      return json({ error: 'bunny_transcribe_failed', status: bunnyRes.status, detail }, 502);
    }

    await admin.from('recordings').update({
      captions_status: 'processing',
      captions_source_lang: sourceLanguage,
      captions_languages: [sourceLanguage, ...targetLanguages],
      captions_updated_at: new Date().toISOString(),
    }).eq('id', recordingId);

    return json({
      ok: true,
      status: 'processing',
      sourceLanguage,
      languages: [sourceLanguage, ...targetLanguages],
    });
  } catch (e) {
    console.error('[generate-captions] error:', e);
    return json({ error: 'internal', message: (e as Error)?.message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
