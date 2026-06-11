// Admin exporta pedidos como CSV filtrado por fecha/vendor/status.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function csvEscape(v: any): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

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

    const url = new URL(req.url);
    const fromDate = url.searchParams.get("from");
    const toDate = url.searchParams.get("to");
    const vendorId = url.searchParams.get("vendorId");
    const status = url.searchParams.get("status");

    let q = supabaseAdmin
      .from("marketplace_orders")
      .select(`
        id, created_at, status, shipping_status, refund_status, total_amount, currency,
        platform_fee, vendor_net, stripe_fee, stripe_session_id, stripe_payment_intent_id,
        quantity, courier_name, tracking_number, shipped_at, delivered_at,
        buyer_id, vendor_id, product_id,
        marketplace_vendors(name),
        marketplace_products(name)
      `)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (fromDate) q = q.gte("created_at", fromDate);
    if (toDate) q = q.lte("created_at", toDate);
    if (vendorId) q = q.eq("vendor_id", vendorId);
    if (status) q = q.eq("status", status);

    const { data: orders, error } = await q;
    if (error) throw error;

    const header = [
      "id", "created_at", "vendor", "product", "qty", "status", "shipping_status", "refund_status",
      "payment_method", "total", "platform_fee", "vendor_net", "stripe_fee", "currency",
      "courier", "tracking", "shipped_at", "delivered_at",
    ];
    const rows = (orders || []).map((o: any) => [
      o.id, o.created_at,
      o.marketplace_vendors?.name || "",
      o.marketplace_products?.name || "",
      o.quantity, o.status, o.shipping_status, o.refund_status,
      (o.stripe_session_id || o.stripe_payment_intent_id) ? 'stripe' : 'wallet',
      o.total_amount, o.platform_fee || "", o.vendor_net || "", o.stripe_fee || "",
      o.currency || "MXN",
      o.courier_name || "", o.tracking_number || "",
      o.shipped_at || "", o.delivered_at || "",
    ]);

    const csv = [header, ...rows].map(r => r.map(csvEscape).join(",")).join("\n");

    return new Response(csv, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="orders_${new Date().toISOString().slice(0,10)}.csv"`,
      },
    });
  } catch (error: any) {
    console.error("export-orders-csv error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
