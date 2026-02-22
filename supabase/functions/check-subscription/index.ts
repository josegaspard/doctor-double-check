import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Determine tier from price amount (in cents) since we use dynamic price_data
function determineTierFromAmount(amountInCents: number): 'basic' | 'premium' {
  // $199 MXN = 19900 cents = premium, anything else = basic
  return amountInCents >= 15000 ? 'premium' : 'basic';
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Parse optional creatorId from request body
    let creatorId: string | null = null;
    try {
      const body = await req.json();
      creatorId = body.creatorId || null;
    } catch {
      // No body or invalid JSON - that's ok
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-03-31.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found, returning unsubscribed state");
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Get all active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 100,
    });

    if (subscriptions.data.length === 0) {
      logStep("No active subscriptions found");
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // If creatorId is specified, check for subscription to that specific creator
    if (creatorId) {
      const creatorSubscription = subscriptions.data.find((sub: any) => 
        sub.metadata?.creator_id === creatorId
      );

      if (!creatorSubscription) {
        logStep("No subscription found for creator", { creatorId });
        return new Response(JSON.stringify({ subscribed: false, creatorId }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      // Use metadata tier or determine from price amount
      const metadataTier = creatorSubscription.metadata?.tier as 'basic' | 'premium' | undefined;
      const priceAmount = creatorSubscription.items.data[0]?.price?.unit_amount || 0;
      const tier = metadataTier || determineTierFromAmount(priceAmount);
      const subscriptionEnd = new Date(creatorSubscription.current_period_end * 1000).toISOString();

      logStep("Found creator subscription", { creatorId, tier, subscriptionEnd });

      return new Response(JSON.stringify({
        subscribed: true,
        creatorId,
        tier,
        subscription_end: subscriptionEnd,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Return all active subscriptions
    const activeSubscriptions = subscriptions.data.map((sub: any) => {
      const metadataTier = sub.metadata?.tier as 'basic' | 'premium' | undefined;
      const priceAmount = sub.items.data[0]?.price?.unit_amount || 0;
      const tier = metadataTier || determineTierFromAmount(priceAmount);
      return {
        subscription_id: sub.id,
        creator_id: sub.metadata?.creator_id,
        tier,
        subscription_end: new Date(sub.current_period_end * 1000).toISOString(),
      };
    });

    logStep("Found subscriptions", { count: activeSubscriptions.length });

    return new Response(JSON.stringify({
      subscribed: true,
      subscriptions: activeSubscriptions,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
