import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getSubscriptionPricing, residentMultiplier } from "../_shared/pricing.ts";
import { getAppConfig } from "../_shared/appconfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CONTENT-CHECKOUT] ${step}${detailsStr}`);
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

    if (stripeKey.startsWith("pk_")) {
      throw new Error("Invalid key: STRIPE_SECRET_KEY contains a publishable key. Need secret key (sk_*)");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);

    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const { contentId } = await req.json();
    if (!contentId) throw new Error("Content ID is required");

    // Fetch content details (simple query without joins)
    const { data: content, error: contentError } = await supabaseClient
      .from("doctor_content")
      .select("id, title, description, price, creator_id, moderation_status")
      .eq("id", contentId)
      .single();

    if (contentError) {
      logStep("Content query error", { error: contentError.message, code: contentError.code });
      throw new Error("Content not found");
    }
    if (!content) throw new Error("Content not found");
    if (!content.price || content.price <= 0) throw new Error("This content is free");
    if (content.creator_id === user.id) throw new Error("You cannot purchase your own content");
    if (content.moderation_status !== 'approved') throw new Error("Content not available");
    logStep("Content found", { title: content.title, price: content.price });

    // Check if already purchased
    const { data: existingPurchase } = await supabaseClient
      .from("purchases")
      .select("id")
      .eq("user_id", user.id)
      .eq("content_id", contentId)
      .maybeSingle();

    if (existingPurchase) {
      return new Response(JSON.stringify({ error: "Content already purchased" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Check user role for discount (mismo descuento residente que el wallet
    // aplica vía get_price_for_user, para que ambos métodos cobren igual)
    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    let finalPrice = content.price;
    if (roleData?.role === "resident") {
      const pricing = await getSubscriptionPricing(supabaseClient);
      finalPrice = content.price * residentMultiplier(pricing);
      logStep("Resident discount applied", { originalPrice: content.price, finalPrice });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-03-31.basil" });
    const appCfg = await getAppConfig(supabaseClient);

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
              name: content.title,
              description: `Libro/Curso digital descargable - Medical Masters`,
            },
            unit_amount: Math.round(finalPrice * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/my-books?book_paid=success`,
      cancel_url: `${req.headers.get("origin")}/doctor/${content.creator_id}?book_paid=canceled`,
      metadata: {
        user_id: user.id,
        content_id: contentId,
        amount: finalPrice.toString(),
        type: "content_purchase",
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
