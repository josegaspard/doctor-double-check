// Paciente solicita devolución. Crea row en order_refunds status=requested.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const httpError = (status: number, message: string) => Object.assign(new Error(message), { status });

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
    if (!userData.user) throw httpError(401, "Usuario no autenticado");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { orderId, reasonCategory, reason, evidence, amount } = body;
    if (!orderId || !reason) throw httpError(400, "orderId y reason requeridos");

    const { data: order } = await supabaseAdmin
      .from("marketplace_orders")
      .select("id, buyer_id, total_amount, currency, refund_status, status")
      .eq("id", orderId)
      .single();
    if (!order) throw httpError(404, "Pedido no encontrado");
    if (order.buyer_id !== userData.user.id) throw httpError(403, "No autorizado");
    if (order.refund_status === "refunded") throw httpError(409, "Pedido ya reembolsado");
    if (["cancelled"].includes(order.status)) throw httpError(409, "Pedido cancelado");
    // Solo se reembolsan pedidos efectivamente cobrados.
    if (!["paid", "processing", "shipped", "delivered"].includes(order.status)) {
      throw httpError(409, "Solo se pueden reembolsar pedidos pagados");
    }

    // Evitar doble/múltiple reembolso: bloquear si ya hay una solicitud abierta
    // y exigir que la suma de reembolsos no supere el total del pedido.
    const { data: priorRefunds } = await supabaseAdmin
      .from("order_refunds")
      .select("amount, status")
      .eq("order_id", orderId);
    const openRefund = (priorRefunds || []).some((r: any) =>
      ["requested", "approved", "processing"].includes(r.status));
    if (openRefund) throw httpError(409, "Ya existe una solicitud de devolución en proceso para este pedido");
    const alreadyRefunded = (priorRefunds || [])
      .filter((r: any) => ["refunded", "partial"].includes(r.status))
      .reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

    const requested = amount && amount > 0 && amount <= order.total_amount ? amount : order.total_amount;
    if (alreadyRefunded + requested > order.total_amount + 0.001) {
      throw httpError(400, "El monto de devolución supera el total del pedido");
    }
    const refundAmount = requested;

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
        // notifications usa la columna 'data' (no 'metadata') y el enum notification_type
        // no tiene tipos de marketplace: se usa 'system' y el detalle va en data.kind.
        type: "system",
        title: "Nueva solicitud de devolución",
        message: `Pedido ${orderId.slice(0, 8)} — ${refundAmount.toFixed(2)} ${order.currency || "MXN"}`,
        data: { kind: "marketplace.refund_requested", refund_id: refundRow.id, order_id: orderId },
      }));
      const { error: notifErr } = await supabaseAdmin.from("notifications").insert(notifs);
      if (notifErr) console.error("request-marketplace-refund notification insert failed:", notifErr.message);
    }

    return new Response(
      JSON.stringify({ ok: true, refund: refundRow }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("request-marketplace-refund error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: error?.status ?? 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
