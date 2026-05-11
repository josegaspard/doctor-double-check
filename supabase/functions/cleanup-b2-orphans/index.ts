// Lists the caller's B2 prefix and deletes any object that does NOT have a
// matching `recordings` row pointing at `b2:<path>`. Used to clean up files
// left behind by failed/aborted deletes or pre-b2-delete-object recordings.
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

const B2 = () => ({
  KEY_ID: Deno.env.get("B2_KEY_ID")!,
  SECRET: Deno.env.get("B2_APPLICATION_KEY")!,
  ENDPOINT: Deno.env.get("B2_ENDPOINT")!,
  BUCKET: Deno.env.get("B2_BUCKET")!,
  REGION: Deno.env.get("B2_REGION")!,
});

async function signedRequest(method: "GET" | "DELETE", path: string, query: string = ""): Promise<Response> {
  const { KEY_ID, SECRET, ENDPOINT, BUCKET, REGION } = B2();
  const t = new Date();
  const amzdate = t.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const datestamp = amzdate.slice(0, 8);
  const canonicalUri = path
    ? `/${BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`
    : `/${BUCKET}/`;
  const payloadHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
  const canonicalHeaders = `host:${ENDPOINT}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzdate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [method, canonicalUri, query, canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const credentialScope = `${datestamp}/${REGION}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzdate, credentialScope, await sha256Hex(canonicalRequest)].join("\n");
  const kDate = await hmacSha256(enc.encode("AWS4" + SECRET), datestamp);
  const kRegion = await hmacSha256(kDate, REGION);
  const kService = await hmacSha256(kRegion, "s3");
  const kSigning = await hmacSha256(kService, "aws4_request");
  const signature = toHex(await hmacSha256(kSigning, stringToSign));
  const auth = `AWS4-HMAC-SHA256 Credential=${KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const url = `https://${ENDPOINT}${canonicalUri}${query ? "?" + query : ""}`;
  return fetch(url, {
    method,
    headers: {
      "Authorization": auth,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzdate,
    },
  });
}

async function listPrefix(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | null = null;
  // Paginate; B2 returns up to 1000 keys per call
  for (let i = 0; i < 50; i++) {
    const qsParts = [
      "list-type=2",
      `prefix=${encodeURIComponent(prefix)}`,
    ];
    if (continuationToken) qsParts.push(`continuation-token=${encodeURIComponent(continuationToken)}`);
    // S3 canonical query string requires sort order
    qsParts.sort();
    const query = qsParts.join("&");
    const res = await signedRequest("GET", "", query);
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`list failed ${res.status}: ${txt.slice(0, 300)}`);
    }
    const xml = await res.text();
    const matches = xml.matchAll(/<Key>([^<]+)<\/Key>/g);
    for (const m of matches) keys.push(m[1]);
    const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
    if (!truncated) break;
    const tokenMatch = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);
    continuationToken = tokenMatch?.[1] ?? null;
    if (!continuationToken) break;
  }
  return keys;
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

    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({}));
    const dryRun = !!body?.dryRun;

    const prefix = `${user.id}/`;
    const allKeys = await listPrefix(prefix);

    // Build the set of paths still referenced by recordings rows
    const { data: rows, error: rowsErr } = await admin
      .from("recordings")
      .select("video_url")
      .eq("doctor_id", user.id);
    if (rowsErr) throw rowsErr;

    const referenced = new Set<string>();
    for (const r of rows ?? []) {
      const vu = r.video_url as string | null;
      if (vu && vu.startsWith("b2:")) referenced.add(vu.replace(/^b2:/, ""));
    }

    const orphans = allKeys.filter(k => !referenced.has(k));

    const deleted: string[] = [];
    const failed: { path: string; status: number; detail: string }[] = [];

    if (!dryRun) {
      for (const key of orphans) {
        const res = await signedRequest("DELETE", key);
        if (res.ok || res.status === 204) {
          deleted.push(key);
        } else {
          const txt = await res.text().catch(() => "");
          failed.push({ path: key, status: res.status, detail: txt.slice(0, 200) });
        }
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      totalInB2: allKeys.length,
      referenced: referenced.size,
      orphans: orphans.length,
      orphanPaths: orphans,
      deleted: dryRun ? [] : deleted,
      failed: dryRun ? [] : failed,
      dryRun,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
