import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { maskEmail } from "../_shared/log-redact.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-WALLET-CHECKOUT] ${step}${detailsStr}`);
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
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: maskEmail(user.email) });

    // SECURITY (2026-05-11 audit): rate-limit Stripe session creation per user
    // to stop enumeration / Stripe quota abuse / mass tab abandonment.
    const rlSupabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const { data: allowed, error: rlErr } = await rlSupabase.rpc(
      "check_and_record_rate_limit",
      { p_bucket: "wallet_checkout", p_key: user.id, p_max: 10, p_window_seconds: 600 }
    );
    if (rlErr) {
      logStep("rate-limit RPC error (allowing through)", { err: rlErr.message });
    } else if (allowed === false) {
      return new Response(JSON.stringify({ error: "Too many checkout attempts. Wait a few minutes." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const amountRaw = body?.amount;
    const amount = typeof amountRaw === 'string' ? Number.parseInt(amountRaw, 10) : Number(amountRaw);

    if (!Number.isFinite(amount)) {
      return new Response(JSON.stringify({ error: "Monto inválido" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (amount < 50) {
      return new Response(JSON.stringify({ error: "El monto mínimo es 50 MXN" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Stripe Checkout: total <= 999,999.99 (moneda). Para MXN entero -> <= 999,999.
    if (amount > 999999) {
      return new Response(JSON.stringify({ error: "El monto máximo por recarga es 999,999 MXN" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    logStep("Amount received", { amount });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-03-31.basil" });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    }

    // Create checkout session for wallet top-up
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: "mxn",
            product_data: {
              name: "Recarga de Wallet",
              description: `Recarga de $${amount} MXN a tu wallet de Medical Masters`,
            },
             unit_amount: Math.round(amount * 100), // Stripe uses cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/wallet?success=true&amount=${amount}`,
      cancel_url: `${req.headers.get("origin")}/wallet?canceled=true`,
      metadata: {
        user_id: user.id,
        amount: amount.toString(),
        type: "wallet_topup",
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
