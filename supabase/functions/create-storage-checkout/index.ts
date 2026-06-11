import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getSubscriptionPricing, residentMultiplier } from "../_shared/pricing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-STORAGE-CHECKOUT] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);

    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const { extraGB } = await req.json();
    if (!extraGB || Number(extraGB) <= 0) throw new Error("Invalid storage plan");

    // Price is SERVER-SIDE from site_settings.storage_pricing (same source the UI
    // reads). Never trust the `price` from the body (before => unlimited GB for $0.01).
    const { data: pricingRow } = await supabaseClient
      .from("site_settings").select("value").eq("id", "storage_pricing").maybeSingle();
    const pricing = (pricingRow?.value ?? {}) as { plans?: { gb: number; price?: number }[]; price_per_gb?: number };
    const pricePerGb = Number(pricing.price_per_gb) > 0 ? Number(pricing.price_per_gb) : 49;
    const matched = (pricing.plans || []).find((p) => Number(p.gb) === Number(extraGB));
    const price = matched && matched.price != null ? Number(matched.price) : Number(extraGB) * pricePerGb;
    if (!price || price <= 0) throw new Error("Invalid storage price");

    // Check user role for resident discount
    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    let finalPrice = price;
    if (roleData?.role === "resident") {
      const pricing = await getSubscriptionPricing(supabaseClient);
      finalPrice = Math.round(price * residentMultiplier(pricing));
      logStep("Resident discount applied", { originalPrice: price, finalPrice });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-03-31.basil" });

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
            currency: "mxn",
            product_data: {
              name: `Expansión de almacenamiento: +${extraGB} GB`,
              description: `Amplía tu Vault Médico en ${extraGB} GB adicionales`,
            },
            unit_amount: Math.round(finalPrice * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/vault?storage_success=true&extra_gb=${extraGB}`,
      cancel_url: `${req.headers.get("origin")}/vault?canceled=true`,
      metadata: {
        user_id: user.id,
        extra_gb: extraGB.toString(),
        amount: finalPrice.toString(),
        type: "storage_upgrade",
      },
    });

    logStep("Checkout session created", { sessionId: session.id });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
