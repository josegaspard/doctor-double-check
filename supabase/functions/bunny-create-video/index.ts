import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const LIBRARY_ID = Deno.env.get('BUNNY_STREAM_LIBRARY_ID');
const API_KEY = Deno.env.get('BUNNY_STREAM_API_KEY');
// Genera signature scoped al videoId — el browser NO recibe el API key raw.
// Algoritmo Bunny: sha256(libraryId + apiKey + expirationTime + videoId) hex
async function signUpload(videoId, expirationUnix) {
  const payload = `${LIBRARY_ID}${API_KEY}${expirationUnix}${videoId}`;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(buf)).map((b)=>b.toString(16).padStart(2, '0')).join('');
}
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') return new Response(null, {
    headers: CORS
  });
  if (req.method !== 'POST') return new Response('Method not allowed', {
    status: 405,
    headers: CORS
  });
  try {
    const auth = req.headers.get('authorization');
    if (!auth) return json({
      error: 'unauthorized'
    }, 401);
    const supa = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_ANON_KEY'), {
      global: {
        headers: {
          Authorization: auth
        }
      }
    });
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return json({
      error: 'unauthorized'
    }, 401);
    const { title, recordingId } = await req.json();
    if (!title || typeof title !== 'string') return json({
      error: 'title required'
    }, 400);
    // Crear video shell en Bunny (server-side, con API key real)
    const createRes = await fetch(`https://video.bunnycdn.com/library/${LIBRARY_ID}/videos`, {
      method: 'POST',
      headers: {
        'AccessKey': API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        title: title.slice(0, 200)
      })
    });
    if (!createRes.ok) {
      const txt = await createRes.text();
      console.error('[bunny-create-video] create failed:', createRes.status, txt);
      return json({
        error: 'bunny_create_failed',
        detail: txt
      }, 502);
    }
    const video = await createRes.json();
    const videoId = video.guid;
    // Firmar upload scoped a este videoId, expira en 2h
    const expirationUnix = Math.floor(Date.now() / 1000) + 2 * 3600;
    const authSignature = await signUpload(videoId, expirationUnix);
    // Endpoint TUS-compatible (también acepta PUT directo con estos headers)
    const uploadUrl = `https://video.bunnycdn.com/library/${LIBRARY_ID}/videos/${videoId}`;
    // Link videoId al recording si nos lo pasaron
    if (recordingId) {
      const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
      await admin.from('recordings').update({
        bunny_video_id: videoId,
        bunny_status: 'uploading'
      }).eq('id', recordingId);
    }
    return json({
      videoId,
      uploadUrl,
      libraryId: LIBRARY_ID,
      authSignature,
      authExpire: expirationUnix
    });
  } catch (e) {
    console.error('[bunny-create-video] error:', e);
    return json({
      error: 'internal',
      message: e?.message
    }, 500);
  }
});
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS,
      'Content-Type': 'application/json'
    }
  });
}
