import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getAppConfig } from "../_shared/appconfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    const { campaign_id, amount: requestedAmount } = await req.json();
    if (!campaign_id) throw new Error("campaign_id required");

    // SECURITY (2026-05-11 audit): bound amount and cross-check ownership.
    // Previously only `amount > 0` was checked, allowing tiny floats or
    // overflow-large values, and the caller's relation to the campaign
    // wasn't verified.
    const amount = Number(requestedAmount);
    // Admin-editable limits + currency (site_settings.app_config), fallback 100/1,000,000/mxn.
    const appCfg = await getAppConfig(supabaseAdmin);
    if (!Number.isFinite(amount) || amount < appCfg.ad_min || amount > appCfg.ad_max) {
      throw new Error(`Amount must be between ${appCfg.ad_min} and ${appCfg.ad_max}`);
    }
    const { data: campaign, error: campErr } = await supabaseAdmin
      .from("ad_campaigns")
      .select("advertiser_id, status")
      .eq("id", campaign_id)
      .single();
    if (campErr || !campaign) throw new Error("Campaign not found");
    if (campaign.advertiser_id !== user.id) {
      throw new Error("Forbidden — not your campaign");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check/create customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: appCfg.currency,
            product_data: {
              name: `Campaña publicitaria - Medical Masters`,
              description: `Presupuesto de $${amount} MXN para campaña publicitaria`,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/advertiser/dashboard?payment=success&campaign_id=${campaign_id}`,
      cancel_url: `${req.headers.get("origin")}/advertiser/dashboard?payment=cancelled`,
      metadata: {
        campaign_id,
        user_id: user.id,
        type: "ad_campaign",
      },
    });

    // Create payment record
    await supabaseAdmin.from("ad_payments").insert({
      campaign_id,
      amount,
      payment_method: "stripe",
      stripe_session_id: session.id,
      status: "pending",
    });

    // Update campaign status
    await supabaseAdmin.from("ad_campaigns").update({
      status: "pending_payment",
    }).eq("id", campaign_id);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
