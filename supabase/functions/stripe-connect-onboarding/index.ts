import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
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
    const userEmail = userData.user.email;

    // Get user profile
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("name")
      .eq("id", userId)
      .single();

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-03-31.basil",
    });

    // Use service role for database operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check if doctor already has a Stripe account
    const { data: bankAccount } = await supabaseAdmin
      .from("doctor_bank_accounts")
      .select("stripe_account_id")
      .eq("doctor_id", userId)
      .maybeSingle();

    let stripeAccountId = bankAccount?.stripe_account_id;

    // Helper to create a new Stripe Connect account
    const createNewAccount = async () => {
      const account = await stripe.accounts.create({
        type: "express",
        country: "MX",
        email: userEmail,
        business_type: "individual",
        capabilities: {
          transfers: { requested: true },
        },
        metadata: {
          user_id: userId,
        },
      });

      // Save to database
      await supabaseAdmin
        .from("doctor_bank_accounts")
        .upsert({
          doctor_id: userId,
          stripe_account_id: account.id,
          stripe_account_status: "pending",
          account_holder_name: profile?.name || "",
        });

      // Update doctor profile
      await supabaseAdmin
        .from("doctor_profiles")
        .update({ stripe_account_id: account.id })
        .eq("user_id", userId);

      return account.id;
    };

    if (!stripeAccountId) {
      stripeAccountId = await createNewAccount();
    }

    // Create account link for onboarding.
    // Fallback to producción si no llega Origin (servidor-a-servidor, curl, etc.)
    // En lugar de localhost que rompería un redirect real del doctor.
    const origin = req.headers.get("origin") || Deno.env.get("APP_URL") || "https://medical-masters.com";
    let accountLink;
    try {
      accountLink = await stripe.accountLinks.create({
        account: stripeAccountId,
        refresh_url: `${origin}/doctor/bank-account?refresh=true`,
        return_url: `${origin}/doctor/bank-account?success=true`,
        type: "account_onboarding",
      });
    } catch (linkError: any) {
      // If mode mismatch (live account with test key or vice versa), create a new account
      if (linkError.message?.includes("live mode") || linkError.message?.includes("test mode")) {
        console.log("Mode mismatch detected, creating new account...");
        stripeAccountId = await createNewAccount();
        accountLink = await stripe.accountLinks.create({
          account: stripeAccountId,
          refresh_url: `${origin}/doctor/bank-account?refresh=true`,
          return_url: `${origin}/doctor/bank-account?success=true`,
          type: "account_onboarding",
        });
      } else {
        throw linkError;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        url: accountLink.url,
        accountId: stripeAccountId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in stripe-connect-onboarding:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Error al crear cuenta de pagos",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
