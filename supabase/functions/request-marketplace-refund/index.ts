// Paciente solicita devolución. Crea row en order_refunds status=requested.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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

    const body = await req.json();
    const { orderId, reasonCategory, reason, evidence, amount } = body;
    if (!orderId || !reason) throw new Error("orderId y reason requeridos");

    const { data: order } = await supabaseAdmin
      .from("marketplace_orders")
      .select("id, buyer_id, total_amount, currency, refund_status, status")
      .eq("id", orderId)
      .single();
    if (!order) throw new Error("Pedido no encontrado");
    if (order.buyer_id !== userData.user.id) throw new Error("No autorizado");
    if (order.refund_status === "refunded") throw new Error("Pedido ya reembolsado");
    if (["cancelled"].includes(order.status)) throw new Error("Pedido cancelado");

    const refundAmount = amount && amount > 0 && amount <= order.total_amount ? amount : order.total_amount;

    const { data: refundRow, error: refundErr } = await supabaseAdmin
      .from("order_refunds")
      .insert({
        order_id: orderId,
        requested_by: userData.user.id,
        amount: refundAmount,
        currency: order.currency || "MXN",
        reason,
        reason_category: reasonCategory || "other",
        status: "requested",
        customer_evidence: evidence || [],
      })
      .select()
      .single();
    if (refundErr) throw refundErr;

    await supabaseAdmin
      .from("marketplace_orders")
      .update({ refund_status: "requested" })
      .eq("id", orderId);

    await supabaseAdmin.from("marketplace_audit_log").insert({
      actor_id: userData.user.id,
      actor_role: "patient",
      action: "refund.request",
      entity_type: "order_refund",
      entity_id: refundRow.id,
      metadata: { order_id: orderId, amount: refundAmount, reason_category: reasonCategory },
    });

    // Notificación al admin
    const { data: admins } = await supabaseAdmin
      .from("user_roles").select("user_id").eq("role", "admin");
    if (admins) {
      const notifs = admins.map((a: any) => ({
        user_id: a.user_id,
        type: "marketplace.refund_requested",
        title: "Nueva solicitud de devolución",
        message: `Pedido ${orderId.slice(0, 8)} — ${refundAmount.toFixed(2)} ${order.currency || "MXN"}`,
        metadata: { refund_id: refundRow.id, order_id: orderId },
      }));
      await supabaseAdmin.from("notifications").insert(notifs);
    }

    return new Response(
      JSON.stringify({ ok: true, refund: refundRow }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("request-marketplace-refund error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
