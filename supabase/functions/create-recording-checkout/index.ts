import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-RECORDING-CHECKOUT] ${step}${detailsStr}`);
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

    const { recordingId } = await req.json();
    if (!recordingId) throw new Error("Recording ID is required");

    // Fetch recording details (simple query without joins)
    const { data: recording, error: recError } = await supabaseClient
      .from("recordings")
      .select("id, title, price, specialty, doctor_id")
      .eq("id", recordingId)
      .single();

    if (recError) {
      logStep("Recording query error", { error: recError.message, code: recError.code });
      throw new Error("Recording not found");
    }
    if (!recording) throw new Error("Recording not found");
    logStep("Recording found", { title: recording.title, price: recording.price });

    // Check if already purchased
    const { data: existingPurchase } = await supabaseClient
      .from("purchases")
      .select("id")
      .eq("user_id", user.id)
      .eq("recording_id", recordingId)
      .maybeSingle();

    if (existingPurchase) {
      return new Response(JSON.stringify({ error: "Recording already purchased" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Check user role for discount
    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    let finalPrice = recording.price;
    if (roleData?.role === "resident") {
      finalPrice = recording.price * 0.5;
      logStep("Resident discount applied", { originalPrice: recording.price, finalPrice });
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
              name: recording.title,
              description: `Grabación de ${recording.specialty} - Medical Masters`,
            },
            unit_amount: Math.round(finalPrice * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/recording/${recordingId}?recording_paid=success`,
      cancel_url: `${req.headers.get("origin")}/recordings?recording_paid=canceled`,
      metadata: {
        user_id: user.id,
        recording_id: recordingId,
        amount: finalPrice.toString(),
        type: "recording_purchase",
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
