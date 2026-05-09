import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const VERIFF_API_KEY = Deno.env.get("VERIFF_API_KEY");
    if (!VERIFF_API_KEY) {
      throw new Error("VERIFF_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, email")
      .eq("id", user.id)
      .single();

    if (!profile) {
      throw new Error("Profile not found");
    }

    // Parse name into first/last
    const nameParts = (profile.name || "").trim().split(" ");
    const firstName = nameParts[0] || "User";
    const lastName = nameParts.slice(1).join(" ") || "User";

    // Get callback URL from request body (optional)
    const body = await req.json().catch(() => ({}));
    const callbackUrl = body.callback_url || "https://medical-masters.com/identity-verification";

    // Create Veriff session
    const veriffResponse = await fetch("https://stationapi.veriff.com/v1/sessions/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AUTH-CLIENT": VERIFF_API_KEY,
      },
      body: JSON.stringify({
        verification: {
          callback: callbackUrl,
          person: {
            firstName,
            lastName,
          },
          vendorData: user.id,
          timestamp: new Date().toISOString(),
        },
      }),
    });

    const veriffData = await veriffResponse.json();

    if (!veriffResponse.ok || veriffData.status !== "success") {
      console.error("Veriff API error:", veriffData);
      throw new Error("Failed to create Veriff session");
    }

    const sessionId = veriffData.verification.id;
    const sessionUrl = veriffData.verification.url;

    // Delete any previous pending veriff sessions for this user
    await supabase
      .from("identity_verifications")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", "veriff")
      .eq("status", "pending");

    // Store verification record in DB
    const { error: insertError } = await supabase
      .from("identity_verifications")
      .insert({
        user_id: user.id,
        provider: "veriff",
        external_id: sessionId,
        status: "pending",
        metadata: {
          session_url: sessionUrl,
          created_via: "veriff_sdk",
        },
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error("Failed to store verification record");
    }

    return new Response(
      JSON.stringify({
        session_url: sessionUrl,
        session_id: sessionId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
