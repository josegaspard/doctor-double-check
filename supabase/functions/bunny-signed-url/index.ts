import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CDN_HOST = Deno.env.get('BUNNY_STREAM_CDN_HOSTNAME');
const TOKEN_KEY = Deno.env.get('BUNNY_STREAM_TOKEN_AUTH_KEY');

async function bunnyTokenHash(data: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  const bytes = new Uint8Array(buf);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Bunny Stream token formula (with IP binding):
 *   SHA256(security_key + dir_path + expires + ip)
 * Bunny CDN re-computes the hash on each segment request using the
 * requesting client's IP. If the IP differs from the one we signed
 * with, the request fails with 403 — even though the token+expires
 * still match. This kills "copy URL and share / use in yt-dlp from
 * another machine" attacks.
 */
async function signDirectory(dirPath: string, expires: number, ip: string) {
  return bunnyTokenHash(`${TOKEN_KEY}${dirPath}${expires}${ip}`);
}

function extractClientIp(req: Request): string {
  // Supabase Edge runtime forwards the real client IP in these headers.
  // x-forwarded-for can be a comma-separated chain — first entry is the client.
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0].trim();
    if (first) return first;
  }
  return req.headers.get('cf-connecting-ip')
    || req.headers.get('x-real-ip')
    || '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST')
    return new Response('Method not allowed', { status: 405, headers: CORS });

  try {
    const auth = req.headers.get('authorization');
    if (!auth) return json({ error: 'unauthorized' }, 401);

    const supa = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } },
    );

    const { data: { user } } = await supa.auth.getUser();
    if (!user) return json({ error: 'unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const { videoId, ttlSec, bindIp } = body;
    if (!videoId || typeof videoId !== 'string')
      return json({ error: 'videoId required' }, 400);

    // TTL corto = anti-piracy. URLs comparten <3 min y mueren.
    // Frontend renueva automáticamente antes de expirar.
    // Defaults: 180s, min 60s, max 1h (no permitimos sesiones largas que
    // dejen URL viva mucho tiempo).
    const ttl = Math.min(Math.max(Number(ttlSec) || 180, 60), 3600);
    const expires = Math.floor(Date.now() / 1000) + ttl;

    // IP binding: si bindIp != false, atamos el token a la IP del cliente.
    // Defaults a true. Para warmup / debug se puede mandar bindIp: false.
    const clientIp = extractClientIp(req);
    const shouldBindIp = bindIp !== false && !!clientIp;
    const ipForHash = shouldBindIp ? clientIp : '';

    // Firmamos el DIRECTORIO /${videoId}/ — un solo token cubre HLS playlist,
    // sub-manifests, .ts segments, MP4 renditions, /original, thumbnail.
    const dirPath = `/${videoId}/`;
    const token = await signDirectory(dirPath, expires, ipForHash);

    const baseUrl = `https://${CDN_HOST}`;
    // El parámetro &token_ip= NO se incluye en URL; Bunny lee la IP del request
    // entrante y la concatena al hash. Nuestro hash debe usar la MISMA IP.
    const queryString = `?token=${token}&expires=${expires}`;

    return json({
      hlsUrl: `${baseUrl}/${videoId}/playlist.m3u8${queryString}`,
      mp4Url: `${baseUrl}/${videoId}/play_720p.mp4${queryString}`,
      mp4Url480: `${baseUrl}/${videoId}/play_480p.mp4${queryString}`,
      mp4Url240: `${baseUrl}/${videoId}/play_240p.mp4${queryString}`,
      originalUrl: `${baseUrl}/${videoId}/original${queryString}`,
      url: `${baseUrl}/${videoId}/playlist.m3u8${queryString}`,
      thumbnailUrl: `${baseUrl}/${videoId}/thumbnail.jpg${queryString}`,
      previewUrl: `${baseUrl}/${videoId}/preview.webp${queryString}`,
      expiresSec: ttl,
      expiresAt: expires,
      ipBound: shouldBindIp,
    });
  } catch (e) {
    console.error('[bunny-signed-url] error:', e);
    return json({ error: 'internal', message: (e as Error)?.message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
