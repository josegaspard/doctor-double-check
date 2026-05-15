// Llamado tras crear un order. Envía email al vendor con detalles de la venta.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { orderId } = await req.json();
    if (!orderId) throw new Error("orderId requerido");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: order } = await supabaseAdmin
      .from("marketplace_orders")
      .select("id, total_amount, currency, quantity, shipping_address, vendor_id, product_id, created_at")
      .eq("id", orderId).single();
    if (!order) throw new Error("Pedido no encontrado");

    const { data: vendor } = await supabaseAdmin
      .from("marketplace_vendors").select("id, name, user_id, payout_email").eq("id", order.vendor_id).single();

    const { data: vendorAuth } = await supabaseAdmin.auth.admin.getUserById(vendor.user_id);
    const vendorEmail = vendor.payout_email || vendorAuth?.user?.email;
    if (!vendorEmail) throw new Error("Vendor sin email");

    const { data: product } = await supabaseAdmin
      .from("marketplace_products").select("name").eq("id", order.product_id).maybeSingle();

    const shipping = order.shipping_address || {};
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;color:#163a83">
        <h2 style="color:#00768B">¡Nueva venta en Medical Masters! 🎉</h2>
        <p>Recibiste un pedido nuevo:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Pedido</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${order.id.slice(0,8).toUpperCase()}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Producto</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${product?.name || "—"}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Cantidad</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${order.quantity}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Total</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${order.total_amount} ${order.currency || "MXN"}</td></tr>
        </table>
        <h3>Dirección de envío</h3>
        <p>${shipping.name || ""}<br>${shipping.line1 || ""} ${shipping.line2 || ""}<br>${shipping.city || ""}, ${shipping.state || ""} ${shipping.postal_code || ""}<br>${shipping.phone || ""}</p>
        <p style="margin-top:24px">Ingresa a <a href="https://medical-masters.com/vendor/orders">/vendor/orders</a> para procesar el envío.</p>
        <hr style="border:0;border-top:1px solid #e5e7eb;margin:24px 0">
        <p style="color:#6b7280;font-size:12px">Medical Masters Marketplace</p>
      </div>
    `;

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY no configurado");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Medical Masters <noreply@medical-masters.com>",
        to: [vendorEmail],
        subject: `🎉 Nueva venta — ${product?.name || "Pedido"} — ${order.total_amount} ${order.currency || "MXN"}`,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Resend: ${errText}`);
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("send-vendor-sale-email error:", error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
