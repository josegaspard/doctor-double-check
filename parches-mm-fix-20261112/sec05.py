p = "/root/mm-fix/seguridad/supabase/functions/bunny-webhook/index.ts"
s = open(p).read()
old1 = """    const payload = await req.json();
    const videoId = payload.VideoGuid;
    const status = payload.Status;
    const libraryId = String(payload.VideoLibraryId || '');
    if (libraryId !== Deno.env.get('BUNNY_STREAM_LIBRARY_ID')) {
      console.warn('[bunny-webhook] mismatched library:', libraryId);
      return new Response('ok'); // 200 silencioso para que Bunny no reintente
    }
    if (!videoId) return new Response('ok');
"""
new1 = """    // Token secreto en la URL configurada en Bunny (?token=...). Si BUNNY_WEBHOOK_SECRET
    // está definido, se exige y se compara en tiempo constante.
    const secret = Deno.env.get('BUNNY_WEBHOOK_SECRET') || '';
    if (secret) {
      const token = new URL(req.url).searchParams.get('token') || '';
      const a = new TextEncoder().encode(token);
      const b = new TextEncoder().encode(secret);
      let diff = a.length ^ b.length;
      for (let i = 0; i < b.length; i++) diff |= (a[i] ?? 0) ^ b[i];
      if (diff !== 0) return new Response('unauthorized', { status: 401 });
    }
    const payload = await req.json();
    const videoId = payload.VideoGuid;
    const libraryId = String(payload.VideoLibraryId || '');
    if (libraryId !== Deno.env.get('BUNNY_STREAM_LIBRARY_ID')) {
      console.warn('[bunny-webhook] mismatched library:', libraryId);
      return new Response('ok'); // 200 silencioso para que Bunny no reintente
    }
    if (!videoId || !/^[0-9a-f-]{36}$/i.test(String(videoId))) return new Response('ok');
    // No fiarse del Status del cuerpo (el webhook es público): leer el estado real en Bunny.
    const vRes = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`,
      { headers: { 'AccessKey': Deno.env.get('BUNNY_STREAM_API_KEY') || '', 'Accept': 'application/json' } },
    );
    if (vRes.status === 404) return new Response('ok');
    if (!vRes.ok) {
      console.error('[bunny-webhook] no se pudo leer el video en Bunny:', vRes.status);
      return new Response('error', { status: 502 }); // Bunny reintenta
    }
    const status = (await vRes.json())?.status;
"""
assert old1 in s
s = s.replace(old1, new1)
open(p, "w").write(s)
print("ok")
