import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-SUBSCRIPTION-CHECKOUT] ${step}${detailsStr}`);
};

// Subscription tiers with prices in MXN
const SUBSCRIPTION_TIERS = {
  basic: {
    name: "Suscripción Básica",
    description: "Acceso a contenido exclusivo y notificaciones",
    price: 9900, // $99 MXN in cents
  },
  premium: {
    name: "Suscripción Premium",
    description: "Todo lo básico + descuentos en grabaciones y chats prioritarios",
    price: 19900, // $199 MXN in cents
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);

    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { creatorId, tier } = await req.json();
    if (!creatorId) throw new Error("creatorId is required");
    if (!tier || !['basic', 'premium'].includes(tier)) throw new Error("Invalid tier. Use 'basic' or 'premium'");

    const tierConfig = SUBSCRIPTION_TIERS[tier as keyof typeof SUBSCRIPTION_TIERS];
    logStep("Subscription request", { creatorId, tier, price: tierConfig.price });

    // Get creator info
    const { data: creatorProfile } = await supabaseClient
      .from('profiles_public')
      .select('name')
      .eq('id', creatorId)
      .single();

    const creatorName = creatorProfile?.name || 'Doctor';

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-03-31.basil" });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    }

    // Create checkout session using dynamic price_data (no hardcoded price IDs needed)
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: "mxn",
            product_data: {
              name: `${tierConfig.name} - ${creatorName}`,
              description: tierConfig.description,
            },
            unit_amount: tierConfig.price,
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${req.headers.get("origin")}/doctor/${creatorId}?subscription=success`,
      cancel_url: `${req.headers.get("origin")}/doctor/${creatorId}?subscription=canceled`,
      metadata: {
        user_id: user.id,
        creator_id: creatorId,
        tier: tier,
        type: "creator_subscription",
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          creator_id: creatorId,
          tier: tier,
        },
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
