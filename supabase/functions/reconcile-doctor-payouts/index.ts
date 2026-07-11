// Reconciliador de payouts de doctor atascados en 'processing'.
// Causa: process-doctor-payouts deduce antes de transferir y marca 'paid' SÓLO
// vía el webhook transfer.updated. Si ese webhook se pierde, el payout queda
// 'processing' para siempre y el lock de "ya hay uno processing" bloquea TODOS
// los payouts futuros de ese doctor (cuyas ganancias ya fueron deducidas).
// Este cron (cada hora) resuelve los que llevan >2h:
//   - con stripe_transfer_id válido en Stripe  -> 'paid'
//   - sin transfer (o no existe en Stripe)     -> 'failed' + re-acreditar ganancias
// Patrón claim-then-act (.eq('status','processing').select()) para no doble-acreditar.
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

// Comparación en tiempo constante para no filtrar el secreto por timing.
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const expected = Deno.env.get("CRON_SECRET");
  const provided = req.headers.get("x-cron-secret") || "";
  if (!expected || !timingSafeEqual(provided, expected)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-03-31.basil" });

    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: stuck, error } = await db
      .from("doctor_payouts")
      .select("id, doctor_id, amount, stripe_transfer_id, created_at")
      .eq("status", "processing")
      .lt("created_at", cutoff);
    if (error) throw error;

    let paid = 0, reverted = 0, kept = 0;
    const details: string[] = [];

    const revert = async (p: any, reason: string) => {
      // Claim first (atomic) so concurrent runs can't double-credit.
      const { data: claimed } = await db
        .from("doctor_payouts")
        .update({ status: "failed", error_message: `Reconciler: ${reason}` })
        .eq("id", p.id).eq("status", "processing").select("id");
      if (claimed && claimed.length) {
        await db.rpc("credit_doctor_earnings", {
          p_doctor_id: p.doctor_id, p_amount: p.amount, p_apply_commission: false,
        });
        reverted++;
        details.push(`${p.id}: reverted (${reason})`);
      }
    };

    for (const p of stuck || []) {
      if (p.stripe_transfer_id) {
        try {
          const tr: any = await stripe.transfers.retrieve(p.stripe_transfer_id);
          if (tr && !tr.reversed) {
            const { data: claimed } = await db
              .from("doctor_payouts")
              .update({ status: "paid", paid_at: new Date().toISOString() })
              .eq("id", p.id).eq("status", "processing").select("id");
            if (claimed && claimed.length) { paid++; details.push(`${p.id}: confirmed paid via Stripe`); }
          } else {
            await revert(p, "stripe transfer reversed");
          }
        } catch (e: any) {
          // Could not confirm in Stripe — leave as-is (do NOT revert: the transfer
          // may have succeeded; reverting could double-pay). Flag for review.
          kept++;
          details.push(`${p.id}: stripe retrieve failed (${e?.message || e}) — left processing`);
        }
      } else {
        // No transfer was ever created → the deduction must be reverted.
        await revert(p, "transfer never initiated");
      }
    }

    return new Response(JSON.stringify({ success: true, scanned: (stuck || []).length, paid, reverted, kept, details }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e?.message || String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
