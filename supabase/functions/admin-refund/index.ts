import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-REFUND] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Auth - verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) throw new Error("User not authenticated");

    // Check if user is admin
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .single();

    if (roleData?.role !== "admin") {
      throw new Error("Unauthorized - admin access required");
    }

    logStep("Admin authenticated", { adminId: userData.user.id });

    const { 
      transaction_id, 
      user_id, 
      amount, 
      reason,
      stripe_payment_intent_id 
    } = await req.json();

    if (!user_id || !amount) {
      throw new Error("user_id and amount are required");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    let stripeRefundId = null;

    // If we have a Stripe payment intent, process refund through Stripe
    if (stripe_payment_intent_id) {
      logStep("Processing Stripe refund", { paymentIntentId: stripe_payment_intent_id, amount });
      
      try {
        const refund = await stripe.refunds.create({
          payment_intent: stripe_payment_intent_id,
          amount: Math.round(amount * 100), // Convert to cents
          reason: "requested_by_customer",
        });
        
        stripeRefundId = refund.id;
        logStep("Stripe refund created", { refundId: refund.id });
      } catch (stripeError: any) {
        logStep("Stripe refund failed", { error: stripeError.message });
        // Continue with wallet refund even if Stripe fails
      }
    }

    // Check if this was an earning from a consultation - reverse doctor pending earnings
    const { data: originalTx } = await supabaseAdmin
      .from("wallet_transactions")
      .select("metadata")
      .eq("id", transaction_id)
      .single();

    if (originalTx?.metadata?.type === 'consultation' && originalTx?.metadata?.doctor_id) {
      const doctorId = originalTx.metadata.doctor_id;
      
      // Reduce doctor pending earnings
      const { data: doctorProfile } = await supabaseAdmin
        .from("doctor_profiles")
        .select("pending_earnings")
        .eq("user_id", doctorId)
        .single();

      if (doctorProfile) {
        const newPendingEarnings = Math.max(0, (doctorProfile.pending_earnings || 0) - amount);
        await supabaseAdmin
          .from("doctor_profiles")
          .update({ pending_earnings: newPendingEarnings })
          .eq("user_id", doctorId);

        logStep("Reversed doctor earnings", { doctorId, amount, newPendingEarnings });
        
        // Notify doctor about the refund
        await supabaseAdmin
          .from("notifications")
          .insert({
            user_id: doctorId,
            type: "system",
            title: "Reembolso procesado",
            message: `Se ha revertido una ganancia de $${amount.toFixed(2)} por un reembolso.`,
            data: { amount, reason },
          });
      }
    }

    // Credit user's wallet
    const { data: wallet } = await supabaseAdmin
      .from("wallets")
      .select("balance")
      .eq("user_id", user_id)
      .single();

    if (wallet) {
      const newBalance = Number(wallet.balance) + amount;
      
      await supabaseAdmin
        .from("wallets")
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq("user_id", user_id);

      logStep("Wallet credited", { userId: user_id, amount, newBalance });
    }

    // Create refund transaction record
    await supabaseAdmin
      .from("wallet_transactions")
      .insert({
        user_id: user_id,
        type: "refund",
        amount: amount,
        description: reason || "Reembolso procesado por administrador",
        status: "paid",
        metadata: { 
          admin_id: userData.user.id,
          original_transaction_id: transaction_id,
          stripe_refund_id: stripeRefundId,
        },
      });

    // Update original transaction if provided
    if (transaction_id) {
      await supabaseAdmin
        .from("wallet_transactions")
        .update({ 
          status: "refunded",
          metadata: { refund_transaction_id: transaction_id }
        })
        .eq("id", transaction_id);
    }

    // Notify user
    await supabaseAdmin
      .from("notifications")
      .insert({
        user_id: user_id,
        type: "system",
        title: "Reembolso procesado",
        message: `Se ha acreditado $${amount.toFixed(2)} a tu billetera.${reason ? ` Motivo: ${reason}` : ''}`,
        data: { amount, reason },
      });

    logStep("Refund completed successfully", { userId: user_id, amount });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Reembolso procesado exitosamente",
        stripe_refund_id: stripeRefundId,
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
