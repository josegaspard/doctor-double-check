// Admin aprueba/rechaza refund. Si aprueba → Stripe refunds.create + actualiza row.
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    if (!userData.user) throw new Error("Usuario no autenticado");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: roleRow } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) throw new Error("Solo admin");

    const body = await req.json();
    const { refundId, action, adminNotes, rejectionReason } = body;
    if (!refundId || !action) throw new Error("refundId y action requeridos");

    const { data: refund } = await supabaseAdmin
      .from("order_refunds").select("*").eq("id", refundId).single();
    if (!refund) throw new Error("Refund no encontrado");
    if (refund.status !== "requested") throw new Error("Refund no está en estado requested");

    if (action === "reject") {
      await supabaseAdmin
        .from("order_refunds")
        .update({
          status: "rejected",
          approved_by: userData.user.id,
          reviewed_at: new Date().toISOString(),
          admin_notes: adminNotes,
          rejection_reason: rejectionReason || "No especificado",
        })
        .eq("id", refundId);

      await supabaseAdmin
        .from("marketplace_orders")
        .update({ refund_status: "rejected" })
        .eq("id", refund.order_id);

      await supabaseAdmin.from("marketplace_audit_log").insert({
        actor_id: userData.user.id, actor_role: "admin",
        action: "refund.reject", entity_type: "order_refund", entity_id: refundId,
        metadata: { rejection_reason: rejectionReason },
      });

      await supabaseAdmin.from("notifications").insert({
        user_id: refund.requested_by,
        type: "marketplace.refund_rejected",
        title: "Tu solicitud de devolución fue rechazada",
        message: rejectionReason || "Contacta soporte para más detalles.",
        metadata: { refund_id: refundId, order_id: refund.order_id },
      });

      return new Response(JSON.stringify({ ok: true, status: "rejected" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action !== "approve") throw new Error("action debe ser 'approve' o 'reject'");

    const { data: order } = await supabaseAdmin
      .from("marketplace_orders")
      .select("stripe_payment_intent_id, stripe_session_id, payment_method, total_amount, currency, buyer_id")
      .eq("id", refund.order_id)
      .single();

    let stripeRefundId: string | null = null;

    if (order?.payment_method === "stripe") {
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-03-31.basil" });
      let paymentIntentId = order.stripe_payment_intent_id;
      if (!paymentIntentId && order.stripe_session_id) {
        const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
        paymentIntentId = session.payment_intent as string;
      }
      if (!paymentIntentId) throw new Error("No se encontró payment_intent del pedido");

      const stripeRefund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: Math.round(Number(refund.amount) * 100),
        metadata: { refund_id: refundId, order_id: refund.order_id },
      });
      stripeRefundId = stripeRefund.id;
    } else if (order?.payment_method === "wallet") {
      // Reembolso a wallet del paciente
      await supabaseAdmin.rpc("wallet_credit", {
        p_user_id: order.buyer_id,
        p_amount: refund.amount,
        p_description: `Reembolso pedido ${refund.order_id.slice(0,8)}`,
        p_metadata: { refund_id: refundId, order_id: refund.order_id },
      }).catch(() => null);
    }

    await supabaseAdmin
      .from("order_refunds")
      .update({
        status: "refunded",
        approved_by: userData.user.id,
        reviewed_at: new Date().toISOString(),
        refunded_at: new Date().toISOString(),
        stripe_refund_id: stripeRefundId,
        admin_notes: adminNotes,
      })
      .eq("id", refundId);

    await supabaseAdmin.from("marketplace_audit_log").insert({
      actor_id: userData.user.id, actor_role: "admin",
      action: "refund.approve", entity_type: "order_refund", entity_id: refundId,
      metadata: { stripe_refund_id: stripeRefundId, amount: refund.amount },
    });

    await supabaseAdmin.from("notifications").insert({
      user_id: refund.requested_by,
      type: "marketplace.refund_approved",
      title: "Tu devolución fue aprobada",
      message: `Recibirás ${refund.amount} ${refund.currency} en los próximos días.`,
      metadata: { refund_id: refundId, order_id: refund.order_id },
    });

    return new Response(
      JSON.stringify({ ok: true, status: "refunded", stripeRefundId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("process-marketplace-refund error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
