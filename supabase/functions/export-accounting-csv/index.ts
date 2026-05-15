// Admin exporta el accounting_ledger como CSV.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function csvEscape(v: any): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes('"') || s.includes(",") || s.includes("\n")) return '"' + s.replace(/"/g, '""') + '"';
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

    let q = supabaseAdmin
      .from("accounting_ledger")
      .select("id, created_at, transaction_group, entry_type, account, amount, currency, order_id, vendor_id, refund_id, payout_id, dispute_id, description")
      .order("created_at", { ascending: true })
      .limit(20000);
    if (fromDate) q = q.gte("created_at", fromDate);
    if (toDate) q = q.lte("created_at", toDate);

    const { data, error } = await q;
    if (error) throw error;

    const header = ["fecha","grupo_tx","tipo","cuenta","monto","moneda","order_id","vendor_id","refund_id","payout_id","dispute_id","descripcion"];
    const rows = (data || []).map((r: any) => [
      r.created_at, r.transaction_group, r.entry_type, r.account,
      r.amount, r.currency, r.order_id || "", r.vendor_id || "",
      r.refund_id || "", r.payout_id || "", r.dispute_id || "", r.description || "",
    ]);

    const csv = [header, ...rows].map(row => row.map(csvEscape).join(",")).join("\n");

    return new Response(csv, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="accounting_${new Date().toISOString().slice(0,10)}.csv"`,
      },
    });
  } catch (error: any) {
    console.error("export-accounting-csv error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
