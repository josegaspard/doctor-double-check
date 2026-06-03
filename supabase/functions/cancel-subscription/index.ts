import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { maskEmail } from "../_shared/log-redact.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CANCEL-SUBSCRIPTION] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("User not authenticated");
    
    const user = userData.user;
    logStep("User authenticated", { userId: user.id, email: maskEmail(user.email) });

    const { creator_id } = await req.json();
    if (!creator_id) throw new Error("creator_id is required");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-03-31.basil" });

    // Use service role for all DB operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Try to cancel Stripe subscription if exists
    let stripeCancelled = false;
    const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
    
    if (customers.data.length > 0) {
      const customerId = customers.data[0].id;
      logStep("Found Stripe customer", { customerId });

      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
        limit: 10,
      });

      for (const sub of subscriptions.data) {
        if (sub.metadata?.creator_id === creator_id) {
          logStep("Found matching Stripe subscription, canceling immediately", { subscriptionId: sub.id });
          await stripe.subscriptions.cancel(sub.id);
          stripeCancelled = true;
          logStep("Stripe subscription canceled");
        }
      }
    }

    // Deactivate subscription in DB - ALWAYS set is_active = false
    const { data: subscription } = await supabaseAdmin
      .from("subscriptions")
      .select("*")
      .eq("subscriber_id", user.id)
      .eq("creator_id", creator_id)
      .eq("is_active", true)
      .maybeSingle();

    if (subscription) {
      await supabaseAdmin
        .from("subscriptions")
        .update({ is_active: false })
        .eq("id", subscription.id);
      
      logStep("Subscription deactivated in DB", { 
        subscriptionId: subscription.id, 
        tier: subscription.tier 
      });

      // Notify the creator
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();

      await supabaseAdmin
        .from("notifications")
        .insert({
          user_id: creator_id,
          type: "subscription_update",
          title: "Suscripción cancelada",
          message: `${profile?.name || "Un usuario"} ha cancelado su suscripción ${subscription.tier !== 'free' ? subscription.tier : ''}`.trim(),
          data: { subscriber_id: user.id, tier: subscription.tier },
        });

      logStep("Creator notified of cancellation");
    } else {
      logStep("No active subscription found to cancel");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Suscripción cancelada exitosamente."
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    logStep("ERROR", { message: error.message });
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
