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
    const { data: userData } = await supabaseClient.auth.getUser(token);
    if (!userData.user) throw new Error("Usuario no autenticado");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json().catch(() => ({}));
    let vendorId = body.vendorId;

    if (!vendorId) {
      const { data: vendor } = await supabaseAdmin
        .from("marketplace_vendors")
        .select("id")
        .eq("user_id", userData.user.id)
        .maybeSingle();
      vendorId = vendor?.id;
    }
    if (!vendorId) throw new Error("Vendor no encontrado");

    const { data: vendor } = await supabaseAdmin
      .from("marketplace_vendors")
      .select("id, stripe_account_id, user_id")
      .eq("id", vendorId)
      .single();

    const { data: roleRow } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
    const isAdmin = !!roleRow;
    if (!isAdmin && vendor.user_id !== userData.user.id) throw new Error("Forbidden");

    if (!vendor.stripe_account_id) {
      return new Response(JSON.stringify({ connected: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-03-31.basil" });
    const account = await stripe.accounts.retrieve(vendor.stripe_account_id);

    const payoutsEnabled = !!account.payouts_enabled;
    const chargesEnabled = !!account.charges_enabled;
    const detailsSubmitted = !!account.details_submitted;

    await supabaseAdmin
      .from("marketplace_vendors")
      .update({
        stripe_payouts_enabled: payoutsEnabled,
        stripe_charges_enabled: chargesEnabled,
        stripe_details_submitted: detailsSubmitted,
      })
      .eq("id", vendorId);

    return new Response(
      JSON.stringify({
        connected: true,
        accountId: account.id,
        payoutsEnabled,
        chargesEnabled,
        detailsSubmitted,
        requirements: account.requirements,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("vendor-stripe-account-status error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
