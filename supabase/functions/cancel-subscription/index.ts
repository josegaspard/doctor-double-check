import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { creator_id } = await req.json();
    if (!creator_id) throw new Error("creator_id is required");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find user's Stripe customer
    const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
    
    if (customers.data.length > 0) {
      const customerId = customers.data[0].id;
      logStep("Found Stripe customer", { customerId });

      // Find active subscription for this creator
      // We'll look for subscriptions with matching metadata
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
        limit: 10,
      });

      for (const sub of subscriptions.data) {
        // Check if this subscription has creator_id metadata matching
        if (sub.metadata?.creator_id === creator_id) {
          logStep("Found matching subscription, canceling at period end", { subscriptionId: sub.id });
          
          // Cancel at period end (user keeps access until end of billing period)
          await stripe.subscriptions.update(sub.id, {
            cancel_at_period_end: true,
          });

          logStep("Subscription scheduled for cancellation", { 
            subscriptionId: sub.id,
            cancelAt: sub.current_period_end 
          });
        }
      }
    }

    // Use service role to update local subscription
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get the subscription record
    const { data: subscription } = await supabaseAdmin
      .from("subscriptions")
      .select("*")
      .eq("subscriber_id", user.id)
      .eq("creator_id", creator_id)
      .eq("is_active", true)
      .maybeSingle();

    if (subscription) {
      // If it's a paid subscription, just mark it for cancellation but keep active until expires_at
      if (subscription.tier !== 'free' && subscription.expires_at) {
        await supabaseAdmin
          .from("subscriptions")
          .update({ 
            // Keep active but mark that it won't renew
            // The webhook will deactivate when Stripe confirms cancellation
          })
          .eq("id", subscription.id);
        
        logStep("Paid subscription - will remain active until", { expiresAt: subscription.expires_at });
      } else {
        // Free subscription - deactivate immediately
        await supabaseAdmin
          .from("subscriptions")
          .update({ is_active: false })
          .eq("id", subscription.id);
        
        logStep("Free subscription deactivated immediately");
      }

      // Create notification for creator
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
          message: `${profile?.name || "Un usuario"} ha cancelado su suscripción`,
          data: { subscriber_id: user.id },
        });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: subscription?.tier !== 'free' 
          ? "Suscripción cancelada. Mantendrás acceso hasta el fin del período pagado."
          : "Suscripción cancelada exitosamente."
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
