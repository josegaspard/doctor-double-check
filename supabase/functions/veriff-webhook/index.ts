import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-hmac-signature, x-auth-client",
};

async function verifyHmac(payload: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex.toLowerCase() === signature.toLowerCase();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const VERIFF_SHARED_SECRET = Deno.env.get("VERIFF_SHARED_SECRET");
    if (!VERIFF_SHARED_SECRET) {
      throw new Error("VERIFF_SHARED_SECRET not configured");
    }

    const rawBody = await req.text();
    
    // Verify HMAC signature
    const signature = req.headers.get("x-hmac-signature") || "";
    if (signature) {
      const isValid = await verifyHmac(rawBody, signature, VERIFF_SHARED_SECRET);
      if (!isValid) {
        console.error("Invalid HMAC signature");
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const payload = JSON.parse(rawBody);
    console.log("Veriff webhook payload:", JSON.stringify(payload));

    // Veriff sends different event types
    const verification = payload.verification || payload;
    const sessionId = verification.id || verification.vendorData;
    const veriffStatus = verification.status || verification.code;
    const vendorData = verification.vendorData; // user_id

    if (!sessionId) {
      console.error("No session ID in payload");
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Map Veriff status to our status
    let dbStatus: string;
    switch (veriffStatus) {
      case "approved":
      case 9001: // Veriff numeric code for approved
        dbStatus = "verified";
        break;
      case "declined":
      case "resubmission_requested":
      case 9102: // declined
      case 9103: // resubmission
      case 9104: // expired
        dbStatus = "failed";
        break;
      default:
        dbStatus = "in_progress";
        break;
    }

    // Update verification record
    const updateData: Record<string, any> = {
      status: dbStatus,
      updated_at: new Date().toISOString(),
      metadata: {
        veriff_status: veriffStatus,
        veriff_code: verification.code,
        reason: verification.reason,
        reasonCode: verification.reasonCode,
      },
    };

    if (dbStatus === "verified") {
      updateData.verified_at = new Date().toISOString();
    }

    // Try to find by external_id first
    const { data: existingRecord } = await supabase
      .from("identity_verifications")
      .select("id, user_id")
      .eq("external_id", sessionId)
      .single();

    if (existingRecord) {
      const { error: updateError } = await supabase
        .from("identity_verifications")
        .update(updateData)
        .eq("id", existingRecord.id);

      if (updateError) {
        console.error("Update error:", updateError);
      }

      // Update profile is_identity_verified flag
      if (dbStatus === "verified") {
        await supabase
          .from("profiles")
          .update({ is_identity_verified: true })
          .eq("id", existingRecord.user_id);
      }

      // Send email notification
      try {
        await supabase.functions.invoke("send-verification-email", {
          body: {
            user_id: existingRecord.user_id,
            status: dbStatus,
          },
        });
      } catch (emailErr) {
        console.warn("Email notification failed:", emailErr);
      }
    } else {
      console.warn("No verification record found for session:", sessionId);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
