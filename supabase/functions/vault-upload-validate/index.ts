import { createClient } from 'npm:@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Magic byte signatures for allowed file types (server-side anti-spoofing)
function detectMimeFromMagicBytes(bytes: Uint8Array): string | null {
  if (bytes.length < 8) return null;
  // PDF: %PDF
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return 'application/pdf';
  }
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  // DICOM: bytes 128-131 = "DICM"
  if (
    bytes.length >= 132 &&
    bytes[128] === 0x44 &&
    bytes[129] === 0x49 &&
    bytes[130] === 0x43 &&
    bytes[131] === 0x4d
  ) {
    return 'application/dicom';
  }
  return null;
}

const ALLOWED = new Set(['application/pdf', 'image/jpeg', 'image/png', 'application/dicom']);
const MAX_BYTES = 20 * 1024 * 1024;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData } = await supabaseClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const form = await req.formData();
    const file = form.get('file');
    const declaredMime = String(form.get('declaredMime') || '');

    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (file.size > MAX_BYTES) {
      return new Response(JSON.stringify({ error: 'File too large (max 20MB)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Read first 256 bytes to inspect magic bytes
    const head = new Uint8Array(await file.slice(0, 256).arrayBuffer());
    const realMime = detectMimeFromMagicBytes(head);

    if (!realMime || !ALLOWED.has(realMime)) {
      return new Response(
        JSON.stringify({
          error: 'File type not allowed or unrecognized',
          declaredMime,
          detectedMime: realMime,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If a declared mime was passed, verify it matches the real one
    if (
      declaredMime &&
      declaredMime !== realMime &&
      !(declaredMime === 'image/jpg' && realMime === 'image/jpeg')
    ) {
      return new Response(
        JSON.stringify({
          error: 'Declared MIME does not match real content',
          declaredMime,
          detectedMime: realMime,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, detectedMime: realMime, size: file.size }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
