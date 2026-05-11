// Issues short-lived pre-signed URLs for Backblaze B2 (S3-compatible).
// - operation=put: lets the caller upload a recording directly to B2 from the browser
// - operation=get: lets the caller stream a recording from B2 for playback
// Verifies the caller via JWT, scopes the upload path to <userId>/* on PUT,
// and only signs GET URLs for paths the caller owns or has purchased.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const enc = new TextEncoder();
async function hmacSha256(key: Uint8Array, msg: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(msg));
  return new Uint8Array(sig);
}
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}
async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return toHex(new Uint8Array(buf));
}

/**
 * Builds an AWS SigV4 query-presigned URL compatible with B2's S3 API.
 * https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html
 */
async function presignS3Url(opts: {
  method: "PUT" | "GET";
  endpoint: string;
  region: string;
  bucket: string;
  key: string;
  keyId: string;
  secret: string;
  expiresSec: number;
  contentType?: string;
}): Promise<string> {
  const { method, endpoint, region, bucket, key, keyId, secret, expiresSec, contentType } = opts;
  const t = new Date();
  const amzdate = t.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const datestamp = amzdate.slice(0, 8);
  const credential = `${keyId}/${datestamp}/${region}/s3/aws4_request`;

  const host = endpoint;
  const canonicalUri = `/${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;

  const signedHeadersList = ["host"];
  const headerLines: Record<string, string> = { host };
  if (method === "PUT" && contentType) {
    headerLines["content-type"] = contentType;
    signedHeadersList.push("content-type");
  }
  signedHeadersList.sort();
  const signedHeaders = signedHeadersList.join(";");
  const canonicalHeaders = signedHeadersList.map(h => `${h}:${headerLines[h]}\n`).join("");

  const queryParams = new URLSearchParams();
  queryParams.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
  queryParams.set("X-Amz-Credential", credential);
  queryParams.set("X-Amz-Date", amzdate);
  queryParams.set("X-Amz-Expires", String(expiresSec));
  queryParams.set("X-Amz-SignedHeaders", signedHeaders);
  // sort keys alphabetically — required by SigV4
  const sortedQs = [...queryParams.entries()].sort(([a],[b]) => a < b ? -1 : 1).map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");

  const payloadHash = "UNSIGNED-PAYLOAD";
  const canonicalRequest = [method, canonicalUri, sortedQs, canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzdate, `${datestamp}/${region}/s3/aws4_request`, await sha256Hex(canonicalRequest)].join("\n");

  const kDate = await hmacSha256(enc.encode("AWS4" + secret), datestamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, "s3");
  const kSigning = await hmacSha256(kService, "aws4_request");
  const signature = toHex(await hmacSha256(kSigning, stringToSign));

  return `https://${host}${canonicalUri}?${sortedQs}&X-Amz-Signature=${signature}`;
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
    const { operation, path, contentType } = body || {};
    if (!operation || !path) {
      return new Response(JSON.stringify({ error: "operation and path required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const KEY_ID = Deno.env.get("B2_KEY_ID")!;
    const SECRET = Deno.env.get("B2_APPLICATION_KEY")!;
    const ENDPOINT = Deno.env.get("B2_ENDPOINT")!;
    const BUCKET = Deno.env.get("B2_BUCKET")!;
    const REGION = Deno.env.get("B2_REGION")!;

    if (operation === "put") {
      // PUT must be under the caller's <userId>/ namespace
      if (!path.startsWith(`${user.id}/`)) {
        return new Response(JSON.stringify({ error: "path must start with your userId/" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const url = await presignS3Url({
        method: "PUT", endpoint: ENDPOINT, region: REGION, bucket: BUCKET, key: path,
        keyId: KEY_ID, secret: SECRET, expiresSec: 3600,
        contentType: contentType || "video/mp4",
      });
      return new Response(JSON.stringify({ url, expiresSec: 3600 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (operation === "get") {
      // GET access: must own the recording OR have a purchase OR it's a free recording
      const admin = createClient(supabaseUrl, serviceKey);
      const { data: rec } = await admin
        .from("recordings")
        .select("id, doctor_id, video_url, price")
        .eq("video_url", `b2:${path}`)
        .maybeSingle();

      if (!rec) {
        return new Response(JSON.stringify({ error: "recording not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const isOwner = rec.doctor_id === user.id;
      const isFree = Number(rec.price) === 0;
      let hasPurchased = false;
      if (!isOwner && !isFree) {
        const { data: purchase } = await admin
          .from("purchases")
          .select("id")
          .eq("user_id", user.id)
          .eq("recording_id", rec.id)
          .maybeSingle();
        hasPurchased = !!purchase;
      }
      if (!isOwner && !isFree && !hasPurchased) {
        return new Response(JSON.stringify({ error: "payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const url = await presignS3Url({
        method: "GET", endpoint: ENDPOINT, region: REGION, bucket: BUCKET, key: path,
        keyId: KEY_ID, secret: SECRET, expiresSec: 3600,
      });
      return new Response(JSON.stringify({ url, expiresSec: 3600 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "unknown operation" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
