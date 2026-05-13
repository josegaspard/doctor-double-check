// Receives Didit's signed webhook when a KYC session completes.
// Verifies HMAC and updates identity_verifications + profiles.is_identity_verified.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-didit-signature, x-signature",
};

async function verifyHmac(secret: string, rawBody: string, signatureHeader: string): Promise<boolean> {
  if (!secret || !signatureHeader) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // Didit may prefix with "sha256=" or send raw hex. Accept both.
  const provided = signatureHeader.replace(/^sha256=/i, "").trim().toLowerCase();
  return provided === expected;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const rawBody = await req.text();
    const sigHeader =
      req.headers.get("x-didit-signature") ??
      req.headers.get("x-signature") ??
      "";
    const secret = Deno.env.get("DIDIT_WEBHOOK_SECRET") ?? "";

    if (secret) {
      const ok = await verifyHmac(secret, rawBody, sigHeader);
      if (!ok) {
        console.warn("Didit webhook: signature mismatch");
        return new Response("invalid signature", {
          status: 401,
          headers: corsHeaders,
        });
      }
    }

    const payload = JSON.parse(rawBody);
    const sessionId: string = payload.session_id ?? payload.id ?? "";
    const decision = payload.decision ?? payload;
    const statusRaw: string = (decision.status ?? payload.status ?? "").toLowerCase();
    const vendorData: string = payload.vendor_data ?? "";

    let mappedStatus: "verified" | "failed" | "in_progress" | "expired" = "in_progress";
    if (statusRaw === "approved") mappedStatus = "verified";
    else if (statusRaw === "declined" || statusRaw === "rejected") mappedStatus = "failed";
    else if (statusRaw === "abandoned" || statusRaw === "expired") mappedStatus = "expired";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const updateRes = await admin
      .from("identity_verifications")
      .update({
        status: mappedStatus,
        verified_at: mappedStatus === "verified" ? new Date().toISOString() : null,
        metadata: { provider: "didit", decision: payload, received_at: new Date().toISOString() },
      })
      .eq("provider_session_id", sessionId);

    if (updateRes.error) console.warn("update identity_verifications failed", updateRes.error);

    if (mappedStatus === "verified" && vendorData) {
      await admin
        .from("profiles")
        .update({ is_identity_verified: true })
        .eq("id", vendorData);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("kyc-didit-webhook error", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
