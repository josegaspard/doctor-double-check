import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      throw new Error("Usuario no autenticado");
    }

    const userId = userData.user.id;

    // Use service role for database operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get bank account record
    const { data: bankAccount } = await supabaseAdmin
      .from("doctor_bank_accounts")
      .select("*")
      .eq("doctor_id", userId)
      .maybeSingle();

    if (!bankAccount?.stripe_account_id) {
      return new Response(
        JSON.stringify({
          success: true,
          hasAccount: false,
          status: null,
          payoutsEnabled: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Get account details from Stripe
    const account = await stripe.accounts.retrieve(bankAccount.stripe_account_id);

    // Determine status
    let status = "pending";
    if (account.details_submitted && account.payouts_enabled) {
      status = "active";
    } else if (account.requirements?.disabled_reason) {
      status = "restricted";
    } else if (account.details_submitted) {
      status = "pending_verification";
    }

    // Update database
    await supabaseAdmin
      .from("doctor_bank_accounts")
      .update({
        stripe_account_status: status,
        payouts_enabled: account.payouts_enabled || false,
        onboarding_completed: account.details_submitted || false,
        is_verified: account.payouts_enabled || false,
      })
      .eq("doctor_id", userId);

    // Update doctor profile
    await supabaseAdmin
      .from("doctor_profiles")
      .update({
        payouts_enabled: account.payouts_enabled || false,
      })
      .eq("user_id", userId);

    return new Response(
      JSON.stringify({
        success: true,
        hasAccount: true,
        status,
        payoutsEnabled: account.payouts_enabled || false,
        detailsSubmitted: account.details_submitted || false,
        requirements: account.requirements,
        bankLast4: account.external_accounts?.data?.[0]?.last4 || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in check-stripe-account-status:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Error al verificar cuenta",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
