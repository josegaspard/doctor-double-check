// Llamado tras crear un order. Envía email al vendor con detalles de la venta.
import { createClient } from "npm:@supabase/supabase-js@2";
import { renderEmail, detailTable, bigAmount } from "../_shared/email-template.ts";

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
    const amountFmt = `$${Number(order.total_amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
    const currency = order.currency || "MXN";
    const shippingAddr = [
      shipping.name,
      [shipping.line1, shipping.line2].filter(Boolean).join(" "),
      [shipping.city, shipping.state, shipping.postal_code].filter(Boolean).join(", "),
      shipping.phone,
    ].filter(Boolean).join("<br>");
    const html = renderEmail({
      preheader: `Nueva venta: ${product?.name || "pedido"} — ${amountFmt} ${currency}`,
      accent: "success",
      eyebrow: "Nueva venta",
      title: "Recibiste un pedido nuevo",
      subtitle: "Procesa el envío desde tu panel de vendor.",
      greeting: `Hola, ${vendor.name || "vendor"}`,
      bodyHtml: `
        ${bigAmount(amountFmt, currency)}
        ${detailTable([
          ["Pedido", `<span style="font-family:ui-monospace,Menlo,Consolas,monospace;">${order.id.slice(0,8).toUpperCase()}</span>`],
          ["Producto", product?.name || "—"],
          ["Cantidad", String(order.quantity)],
        ])}
        <h3 style="margin:20px 0 8px;font-size:14px;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:.4px;">Dirección de envío</h3>
        <div style="padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;line-height:22px;color:#0f172a;">${shippingAddr || "<em>Sin dirección</em>"}</div>
      `,
      ctaText: "Procesar el envío",
      ctaUrl: "https://medical-masters.com/vendor/orders",
    });

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY no configurado");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Medical Masters <noreply@medical-masters.com>",
        to: [vendorEmail],
        subject: `Nueva venta: ${product?.name || "Pedido"} — ${amountFmt} ${currency}`,
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
