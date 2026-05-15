import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Usuario no autenticado");

    const userId = userData.user.id;
    const userEmail = userData.user.email;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: vendor } = await supabaseAdmin
      .from("marketplace_vendors")
      .select("id, stripe_account_id, name, legal_name")
      .eq("user_id", userId)
      .eq("status", "approved")
      .maybeSingle();

    if (!vendor) throw new Error("Vendor no encontrado o no aprobado");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-03-31.basil",
    });

    let stripeAccountId = vendor.stripe_account_id;

    const createNewAccount = async () => {
      const account = await stripe.accounts.create({
        type: "express",
        country: "MX",
        email: userEmail,
        business_type: "company",
        capabilities: {
          transfers: { requested: true },
        },
        metadata: {
          vendor_id: vendor.id,
          user_id: userId,
          source: "marketplace",
        },
        business_profile: {
          name: vendor.legal_name || vendor.name,
        },
      });

      await supabaseAdmin
        .from("marketplace_vendors")
        .update({ stripe_account_id: account.id })
        .eq("id", vendor.id);

      return account.id;
    };

    if (!stripeAccountId) {
      stripeAccountId = await createNewAccount();
    }

    const origin = req.headers.get("origin") || "http://localhost:5173";
    let accountLink;
    try {
      accountLink = await stripe.accountLinks.create({
        account: stripeAccountId,
        refresh_url: `${origin}/vendor/stripe-setup?refresh=true`,
        return_url: `${origin}/vendor/stripe-setup?success=true`,
        type: "account_onboarding",
      });
    } catch (linkError: any) {
      if (linkError.message?.includes("live mode") || linkError.message?.includes("test mode")) {
        stripeAccountId = await createNewAccount();
        accountLink = await stripe.accountLinks.create({
          account: stripeAccountId,
          refresh_url: `${origin}/vendor/stripe-setup?refresh=true`,
          return_url: `${origin}/vendor/stripe-setup?success=true`,
          type: "account_onboarding",
        });
      } else {
        throw linkError;
      }
    }

    return new Response(
      JSON.stringify({ success: true, url: accountLink.url, accountId: stripeAccountId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("vendor-stripe-connect-onboarding error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Error al crear cuenta vendor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
