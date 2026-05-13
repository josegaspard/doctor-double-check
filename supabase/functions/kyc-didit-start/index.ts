// Starts a Didit KYC session (free tier alternative to Veriff while
// the Veriff subscription is paused). Returns a verification_url the
// frontend can redirect to. Requires DIDIT_API_KEY + DIDIT_WORKFLOW_ID.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser(jwt);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const DIDIT_API_KEY = Deno.env.get("DIDIT_API_KEY");
    const DIDIT_WORKFLOW_ID = Deno.env.get("DIDIT_WORKFLOW_ID");
    if (!DIDIT_API_KEY || !DIDIT_WORKFLOW_ID) {
      return new Response(JSON.stringify({ error: "Didit not configured. Set DIDIT_API_KEY + DIDIT_WORKFLOW_ID in Supabase secrets." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callbackUrl = "https://medical-masters.com/verify-identity";

    const diditRes = await fetch("https://verification.didit.me/v3/session/", {
      method: "POST",
      headers: {
        "x-api-key": DIDIT_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workflow_id: DIDIT_WORKFLOW_ID,
        callback: callbackUrl,
        vendor_data: user.id,
      }),
    });

    if (!diditRes.ok) {
      const errText = await diditRes.text();
      console.error("Didit session create failed", diditRes.status, errText);
      return new Response(JSON.stringify({ error: `Didit ${diditRes.status}: ${errText}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const session = await diditRes.json();
    const sessionId: string = session.session_id ?? session.id ?? "";
    const verificationUrl: string = session.verification_url ?? session.url ?? "";

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    await admin.from("identity_verifications").insert({
      user_id: user.id,
      provider: "didit",
      provider_session_id: sessionId,
      status: "pending",
      metadata: { workflow_id: DIDIT_WORKFLOW_ID, callback: callbackUrl },
    });

    return new Response(JSON.stringify({ session_id: sessionId, verification_url: verificationUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("kyc-didit-start error", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
