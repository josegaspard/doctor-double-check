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
    return new Response('ok');
  } catch (e) {
    console.error('[bunny-webhook] error:', e);
    return new Response('error', {
      status: 500
    });
  }
});
