// Procesa payouts en MASA a vendors con Stripe Connect.
// Llamado por admin con body { vendorIds?: string[], dryRun?: boolean }
// Si vendorIds vacío, procesa todos los vendors con balance disponible.
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
    if (!roleRow) throw new Error("Solo admin puede ejecutar payouts");

    const body = await req.json().catch(() => ({}));
    const vendorIds: string[] | undefined = body.vendorIds;
    const dryRun: boolean = !!body.dryRun;

    const { data: balances, error: balErr } = await supabaseAdmin.rpc("get_vendor_payout_balance", {
      p_vendor_id: null,
    });
    if (balErr) throw balErr;

    const eligible = (balances || []).filter((b: any) => {
      if (vendorIds && vendorIds.length > 0 && !vendorIds.includes(b.vendor_id)) return false;
      return b.payouts_enabled && b.stripe_account_id && b.available_amount > 0;
    });

    if (dryRun) {
      return new Response(
        JSON.stringify({ ok: true, dryRun: true, eligibleCount: eligible.length, eligible }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-03-31.basil" });

    const results: any[] = [];

    for (const v of eligible) {
      try {
        const { data: earnings } = await supabaseAdmin
          .from("vendor_earnings")
          .select("id, net_amount, currency")
          .eq("vendor_id", v.vendor_id)
          .eq("status", "pending")
          .lte("available_at", new Date().toISOString())
          .is("payout_id", null);

        if (!earnings || earnings.length === 0) continue;

        const total = earnings.reduce((s: number, e: any) => s + Number(e.net_amount), 0);
        const currency = (earnings[0].currency || "MXN").toLowerCase();
        const amountCents = Math.round(total * 100);

        const { data: payoutRow, error: payoutErr } = await supabaseAdmin
          .from("vendor_payouts")
          .insert({
            vendor_id: v.vendor_id,
            total_amount: total,
            currency: currency.toUpperCase(),
            earnings_count: earnings.length,
            status: "processing",
            initiated_by: userData.user.id,
          })
          .select()
          .single();
        if (payoutErr) throw payoutErr;

        await supabaseAdmin
          .from("vendor_earnings")
          .update({ payout_id: payoutRow.id, status: "reserved" })
          .in("id", earnings.map((e: any) => e.id));

        const transfer = await stripe.transfers.create({
          amount: amountCents,
          currency,
          destination: v.stripe_account_id,
          metadata: { vendor_id: v.vendor_id, payout_id: payoutRow.id, earnings_count: String(earnings.length) },
          description: `Marketplace payout — ${earnings.length} ventas`,
        });

        await supabaseAdmin
          .from("vendor_payouts")
          .update({
            stripe_transfer_id: transfer.id,
            status: "paid",
            paid_at: new Date().toISOString(),
          })
          .eq("id", payoutRow.id);

        await supabaseAdmin.from("marketplace_audit_log").insert({
          actor_id: userData.user.id,
          actor_role: "admin",
          action: "payout.bulk_paid",
          entity_type: "vendor_payout",
          entity_id: payoutRow.id,
          metadata: { vendor_id: v.vendor_id, amount: total, transfer_id: transfer.id, earnings: earnings.length },
        });

        results.push({ vendorId: v.vendor_id, vendorName: v.vendor_name, amount: total, transferId: transfer.id, ok: true });
      } catch (err: any) {
        console.error("payout error vendor", v.vendor_id, err);
        results.push({ vendorId: v.vendor_id, vendorName: v.vendor_name, ok: false, error: err.message });
      }
    }

    return new Response(
      JSON.stringify({ ok: true, processed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("process-vendor-payouts error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
