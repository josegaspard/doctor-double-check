import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  try {
    logStep("Webhook received");
    
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const signature = req.headers.get("stripe-signature");
    const body = await req.text();

    let event: Stripe.Event;

    // Verify webhook signature if secret is configured
    if (webhookSecret && signature) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
        logStep("Webhook signature verified");
      } catch (err) {
        logStep("Webhook signature verification failed", { error: err });
        return new Response(JSON.stringify({ error: "Webhook signature verification failed" }), { status: 400 });
      }
    } else {
      // For development, parse without verification
      event = JSON.parse(body);
      logStep("Webhook parsed without signature verification (dev mode)");
    }

    logStep("Event type", { type: event.type });

    // Handle checkout.session.completed
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      logStep("Checkout session completed", { sessionId: session.id, metadata: session.metadata });

      if (session.metadata?.type === "wallet_topup" && session.payment_status === "paid") {
        const userId = session.metadata.user_id;
        const amount = parseFloat(session.metadata.amount);
        
        logStep("Processing wallet topup", { userId, amount });

        // Use service role to update wallet
        const supabaseAdmin = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
          { auth: { persistSession: false } }
        );

        // Create transaction record
        const { error: txError } = await supabaseAdmin
          .from("wallet_transactions")
          .insert({
            user_id: userId,
            type: "topup",
            amount: amount,
            description: `Recarga via Stripe - ${session.id}`,
            status: "paid",
            metadata: { stripe_session_id: session.id },
          });

        if (txError) {
          logStep("Error creating transaction", { error: txError });
          throw txError;
        }

        // Update wallet balance
        const { error: walletError } = await supabaseAdmin.rpc("process_wallet_topup", {
          p_amount: 0, // We already added the transaction, just need to update balance
        });

        // Alternative: direct update
        const { data: currentWallet } = await supabaseAdmin
          .from("wallets")
          .select("balance")
          .eq("user_id", userId)
          .single();

        if (currentWallet) {
          const newBalance = Number(currentWallet.balance) + amount;
          await supabaseAdmin
            .from("wallets")
            .update({ balance: newBalance, updated_at: new Date().toISOString() })
            .eq("user_id", userId);
          
          logStep("Wallet updated successfully", { userId, newBalance });
        }
      }

      if (session.metadata?.type === "recording_purchase" && session.payment_status === "paid") {
        const userId = session.metadata.user_id;
        const recordingId = session.metadata.recording_id;
        const amount = parseFloat(session.metadata.amount);
        
        logStep("Processing recording purchase", { userId, recordingId, amount });

        const supabaseAdmin = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
          { auth: { persistSession: false } }
        );

        // Create purchase record
        const { error: purchaseError } = await supabaseAdmin
          .from("purchases")
          .insert({
            user_id: userId,
            recording_id: recordingId,
            amount: amount,
          });

        if (purchaseError) {
          logStep("Error creating purchase", { error: purchaseError });
        } else {
          logStep("Purchase recorded successfully", { userId, recordingId });
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
