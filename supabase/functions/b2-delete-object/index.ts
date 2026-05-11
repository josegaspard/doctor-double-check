// Deletes an object from Backblaze B2. The caller must own a recording row
// pointing at b2:<path>; we verify that before issuing the signed DELETE
// against B2's S3-compatible API.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const enc = new TextEncoder();
async function hmacSha256(key: Uint8Array, msg: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(msg)));
}
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}
async function sha256Hex(s: string): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s))));
}

async function signedRequest(method: "DELETE" | "HEAD", path: string): Promise<Response> {
  const KEY_ID = Deno.env.get("B2_KEY_ID")!;
  const SECRET = Deno.env.get("B2_APPLICATION_KEY")!;
  const ENDPOINT = Deno.env.get("B2_ENDPOINT")!;
  const BUCKET = Deno.env.get("B2_BUCKET")!;
  const REGION = Deno.env.get("B2_REGION")!;

  const t = new Date();
  const amzdate = t.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const datestamp = amzdate.slice(0, 8);
  const canonicalUri = `/${BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
  const payloadHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"; // empty body
  const canonicalHeaders = `host:${ENDPOINT}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzdate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [method, canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const credentialScope = `${datestamp}/${REGION}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzdate, credentialScope, await sha256Hex(canonicalRequest)].join("\n");
  const kDate = await hmacSha256(enc.encode("AWS4" + SECRET), datestamp);
  const kRegion = await hmacSha256(kDate, REGION);
  const kService = await hmacSha256(kRegion, "s3");
  const kSigning = await hmacSha256(kService, "aws4_request");
  const signature = toHex(await hmacSha256(kSigning, stringToSign));
  const auth = `AWS4-HMAC-SHA256 Credential=${KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return fetch(`https://${ENDPOINT}${canonicalUri}`, {
    method,
    headers: {
      "Authorization": auth,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzdate,
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { path } = body || {};
    if (!path) {
      return new Response(JSON.stringify({ error: "path required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Caller must own a recording row pointing at this path, OR the path must be
    // in the caller's <userId>/ namespace (admin cleanup case = caller is the doctor)
    if (!path.startsWith(`${user.id}/`)) {
      const admin = createClient(supabaseUrl, serviceKey);
      const { data: rec } = await admin
        .from("recordings")
        .select("id, doctor_id")
        .eq("video_url", `b2:${path}`)
        .maybeSingle();
      if (!rec || rec.doctor_id !== user.id) {
        return new Response(JSON.stringify({ error: "forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const res = await signedRequest("DELETE", path);
    if (!res.ok && res.status !== 204) {
      const errText = await res.text().catch(() => "");
      return new Response(JSON.stringify({ error: "b2 delete failed", status: res.status, detail: errText.slice(0, 300) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, path }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
