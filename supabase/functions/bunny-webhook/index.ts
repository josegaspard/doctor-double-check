import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
// Bunny Stream webhook — público (sin JWT). Bunny llama acá cuando el video
// termina de procesarse o falla.
// Payload típico:
//   { VideoLibraryId, VideoGuid, Status }
//   Status: 0=Created, 1=Uploaded, 2=Processing, 3=Transcoding, 4=Finished, 5=Error, 6=UploadFailed
Deno.serve(async (req)=>{
  if (req.method !== 'POST') return new Response('Method not allowed', {
    status: 405
  });
  try {
    const payload = await req.json();
    const videoId = payload.VideoGuid;
    const status = payload.Status;
    const libraryId = String(payload.VideoLibraryId || '');
    if (libraryId !== Deno.env.get('BUNNY_STREAM_LIBRARY_ID')) {
      console.warn('[bunny-webhook] mismatched library:', libraryId);
      return new Response('ok'); // 200 silencioso para que Bunny no reintente
    }
    if (!videoId) return new Response('ok');
    let bunnyStatus = 'processing';
    if (status === 4) bunnyStatus = 'ready';
    else if (status === 5 || status === 6) bunnyStatus = 'failed';
    const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    const { error } = await admin.from('recordings').update({
      bunny_status: bunnyStatus
    }).eq('bunny_video_id', videoId);
    if (error) console.error('[bunny-webhook] update error:', error);
    console.log('[bunny-webhook] updated', videoId, '→', bunnyStatus);

    // AUTO-SUBTÍTULOS para grabaciones de LIVES: cuando el video queda 'ready' y
    // proviene de un live (live_id != null), disparamos transcripción + traducción
    // a los 8 idiomas de la app automáticamente (sin que el doctor pulse el botón).
    if (bunnyStatus === 'ready') {
      try {
        const { data: rec } = await admin
          .from('recordings')
          .select('id, live_id, captions_status')
          .eq('bunny_video_id', videoId)
          .maybeSingle();
        const already = rec?.captions_status === 'processing'
          || rec?.captions_status === 'ready'
          || rec?.captions_status === 'done';
        if (rec?.live_id && !already) {
          const LIBRARY_ID = Deno.env.get('BUNNY_STREAM_LIBRARY_ID');
          const API_KEY = Deno.env.get('BUNNY_STREAM_API_KEY');
          const APP_LANGUAGES = ['es', 'en', 'pt', 'fr', 'it', 'de', 'ca', 'zh'];
          const sourceLanguage = 'es';
          const targetLanguages = APP_LANGUAGES.filter((l) => l !== sourceLanguage);
          const tRes = await fetch(
            `https://video.bunnycdn.com/library/${LIBRARY_ID}/videos/${videoId}/transcribe?force=true`,
            {
              method: 'POST',
              headers: { 'AccessKey': API_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' },
              body: JSON.stringify({ sourceLanguage, targetLanguages }),
            },
          );
          if (tRes.ok) {
            await admin.from('recordings').update({
              captions_status: 'processing',
              captions_source_lang: sourceLanguage,
              captions_languages: [sourceLanguage, ...targetLanguages],
              captions_updated_at: new Date().toISOString(),
            }).eq('id', rec.id);
            console.log('[bunny-webhook] auto-captions disparadas para live recording', rec.id);
          } else {
            console.error('[bunny-webhook] auto-captions transcribe failed:', tRes.status, await tRes.text());
          }
        }
      } catch (capErr) {
        console.error('[bunny-webhook] auto-captions error:', capErr);
      }
    }

    return new Response('ok');
  } catch (e) {
    console.error('[bunny-webhook] error:', e);
    return new Response('error', {
      status: 500
    });
  }
});
