import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/auth-guards.ts";

// Error con código HTTP (p. ej. 409 en un doble reembolso); el resto sigue en 500.
class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-REFUND] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
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
    if (!authHeader) return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ success: false, error: "User not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Un usuario puede tener varios roles: .single() fallaba con 2 filas y dejaba fuera al admin.
    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();

    if (!adminRole) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized - admin access required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    logStep("Admin authenticated", { adminId: userData.user.id });

    const { 
      transaction_id, 
      user_id, 
      amount, 
      reason,
      stripe_payment_intent_id,
      refund_method = 'wallet',
      refund_request_id,
    } = await req.json();

    if (!user_id || !amount) {
      throw new Error("user_id and amount are required");
    }

    // SECURITY (2026-05-11 audit): cap refund at the source transaction's
    // remaining refundable amount. Previously a compromised admin token (or
    // bug elsewhere) could refund more than what was originally charged.
    let isFullRefund = false;
    if (transaction_id) {
      const { data: srcTx } = await supabaseAdmin
        .from("wallet_transactions")
        .select("amount, user_id")
        .eq("id", transaction_id)
        .single();
      if (!srcTx) throw new Error("Source transaction not found");
      if (srcTx.user_id !== user_id) throw new Error("Transaction does not belong to that user");

      const { data: priorRefunds } = await supabaseAdmin
        .from("wallet_transactions")
        .select("amount")
        .eq("metadata->>original_transaction_id", transaction_id)
        .eq("type", "refund")
        .eq("status", "paid");
      const alreadyRefunded = (priorRefunds || []).reduce(
        (acc, r: any) => acc + Math.abs(Number(r.amount || 0)),
        0,
      );
      // Purchases are stored as negative amounts; compare against the absolute value.
      const maxRefundable = Math.abs(Number(srcTx.amount)) - alreadyRefunded;
      if (maxRefundable <= 0.001) {
        throw new HttpError(409, "Esta compra ya fue reembolsada por completo");
      }
      if (Number(amount) > maxRefundable + 0.001) {
        throw new HttpError(409,
          `Refund exceeds remaining refundable amount (max ${maxRefundable.toFixed(2)})`,
        );
      }
      isFullRefund = Number(amount) >= maxRefundable - 0.001;
    }
    if (Number(amount) <= 0 || !Number.isFinite(Number(amount))) {
      throw new Error("amount must be a positive number");
    }

    // ANTI DOBLE-REEMBOLSO (2026-07-03): reclamar la solicitud de forma atómica.
    // Un UPDATE condicional (status 'requested' -> 'processing') con lock de fila:
    // dos llamadas concurrentes (2 pestañas / 2 admins / retry) sólo dejan que UNA
    // avance; la otra matchea 0 filas y aborta antes de tocar Stripe/wallet.
    if (refund_request_id) {
      const { data: claimed, error: claimErr } = await supabaseAdmin
        .from("refund_requests")
        // El estado inicial de una solicitud es 'pending' (default de la tabla y del
        // insert del paciente en TransactionHistory). Antes se reclamaba 'requested',
        // que NUNCA existe para esta tabla → todo reembolso por solicitud fallaba con
        // "already processed". Además el candado usa 'approved' como estado transitorio
        // (permitido por el trigger validate_refund_request_status; 'processing' NO lo
        // está). pending → approved → processed. (Fix 2026-08-17.)
        .update({ status: "approved", reviewed_by: userData.user.id })
        .eq("id", refund_request_id)
        .eq("status", "pending")
        .select("id");
      if (claimErr) throw new Error(`Could not lock refund request: ${claimErr.message}`);
      if (!claimed || claimed.length === 0) {
        throw new HttpError(409, "Refund request already processed or in progress");
      }
    }

    // Clave de idempotencia determinística para que un reintento NO cree un 2º refund en Stripe.
    const refundIdemKey = refund_request_id
      ? `refund_req_${refund_request_id}`
      : `refund_tx_${transaction_id ?? "na"}_${Math.round(Number(amount) * 100)}`;

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-03-31.basil" });

    let stripeRefundId = null;

    // Revierte al médico el NETO de la venta original (si la venta era de un médico).
    const reverseDoctorEarnings = async () => {
      if (!transaction_id) return;
      const { data: originalTx } = await supabaseAdmin
        .from("wallet_transactions")
        .select("metadata")
        .eq("id", transaction_id)
        .single();

      // Resolver a QUÉ doctor y con qué comisión revertir. Antes SOLO 'consultation'
      // revertía; las compras de grabación/libro (metadata {recording_id}/{content_id},
      // sin doctor_id) nunca revertían → el doctor cobraba de más en cada reembolso.
      // Segunda opinión y consulta en vivo se cobran como consulta (metadata.type
      // 'double_check' / 'live_consultation' con doctor_id) y también se revierten.
      const meta = originalTx?.metadata || {};
      let doctorId: string | null = meta.doctor_id ?? null;
      let commissionKind = "consultation";

      if (meta.type === 'consultation' || meta.type === 'double_check' || meta.type === 'live_consultation') {
        commissionKind = "consultation";
      } else if (meta.recording_id) {
        commissionKind = "recording";
        if (!doctorId) {
          const { data: rec } = await supabaseAdmin
            .from("recordings").select("doctor_id").eq("id", meta.recording_id).maybeSingle();
          doctorId = (rec as any)?.doctor_id ?? null;
        }
      } else if (meta.content_id) {
        commissionKind = "content";
        if (!doctorId) {
          const { data: dc } = await supabaseAdmin
            .from("doctor_content").select("creator_id").eq("id", meta.content_id).maybeSingle();
          doctorId = (dc as any)?.creator_id ?? null;
        }
      } else {
        doctorId = null; // recarga de wallet u otro: nada que revertir al doctor
      }

      if (!doctorId) return;
      const { data: doctorProfile } = await supabaseAdmin
        .from("doctor_profiles")
        .select("pending_earnings")
        .eq("user_id", doctorId)
        .single();
      if (!doctorProfile) return;

      // Al doctor se le acreditó el NETO (bruto − comisión), NO el bruto. Revertir el
      // bruto lo dejaba perdiendo de más. Se resta el neto usando la tasa de comisión
      // correspondiente al tipo de venta (consultation/recording/content).
      const { data: rate } = await supabaseAdmin.rpc("fn_commission_rate", { p_kind: commissionKind });
      const commissionRate = Number.isFinite(Number(rate)) ? Number(rate) : 0.20;
      const netToReverse = Number((amount * (1 - commissionRate)).toFixed(2));
      const newPendingEarnings = Math.max(0, (doctorProfile.pending_earnings || 0) - netToReverse);
      await supabaseAdmin.from("doctor_profiles").update({ pending_earnings: newPendingEarnings }).eq("user_id", doctorId);
      logStep("Reversed doctor earnings (net)", { doctorId, amount, commissionKind, commissionRate, netToReverse, newPendingEarnings });

      await supabaseAdmin.from("notifications").insert({
        user_id: doctorId, type: "system",
        title: "Reembolso procesado",
        message: `Se ha revertido una ganancia de $${netToReverse.toFixed(2)} por un reembolso.`,
        data: { amount: netToReverse, reason },
      });
    };

    // Marca 'refunded' la venta original FUSIONANDO su metadata (antes la pisaba).
    // functions.invoke no lanza en respuestas no-2xx: hay que revisar `error`.
    const sendRefundEmail = async (body: Record<string, unknown>) => {
      try {
        // Con la clave nueva (sb_secret) el gateway cambia el Authorization por un JWT
        // acuñado y send-refund-email respondía 401: se manda también x-cron-secret,
        // que requireAdminOrCron acepta (solo si el secreto existe en el entorno).
        const cronSecret = Deno.env.get("CRON_SECRET");
        const { error } = await supabaseAdmin.functions.invoke("send-refund-email", {
          body,
          ...(cronSecret ? { headers: { "x-cron-secret": cronSecret } } : {}),
        });
        if (error) logStep("Email send failed (non-blocking)", { error: error.message, refund_method: body.refund_method });
        else logStep("Refund email sent", { refund_method: body.refund_method });
      } catch (e) { logStep("Email send failed (non-blocking)", { error: (e as any).message }); }
    };

    // Si la BD aún no admite 'refunded' en transaction_status, se registra y se sigue:
    // el reembolso ya está hecho y no debe fallar por esto.
    const markOriginalRefunded = async (refundTxId: string | null, method: string) => {
      if (!transaction_id) return;
      const { data: orig } = await supabaseAdmin
        .from("wallet_transactions").select("metadata").eq("id", transaction_id).maybeSingle();
      const { error: markErr } = await supabaseAdmin.from("wallet_transactions").update({
        status: "refunded",
        metadata: {
          ...((orig as any)?.metadata || {}),
          refund_transaction_id: refundTxId,
          refund_method: method,
          refunded_at: new Date().toISOString(),
        },
      }).eq("id", transaction_id);
      if (markErr) logStep("Could not mark original transaction as refunded (non-blocking)", { error: markErr.message });
    };

    // Consulta / segunda opinión / consulta desde live reembolsada por completo:
    // se cierra igual que hace request_consultation_refund (status 'refunded' y
    // chat archivado). Antes seguía 'active'. consultations.status es texto libre.
    const closeRefundedConsultation = async () => {
      if (!transaction_id || !isFullRefund) return;
      const { data: orig } = await supabaseAdmin
        .from("wallet_transactions").select("metadata").eq("id", transaction_id).maybeSingle();
      const consultationId = (orig as any)?.metadata?.consultation_id;
      if (!consultationId) return;
      const { data: closed, error: closeErr } = await supabaseAdmin.from("consultations")
        .update({ status: "refunded", ended_at: new Date().toISOString() })
        .eq("id", consultationId)
        .not("status", "in", "(completed,refunded)")
        .select("chat_session_id");
      if (closeErr) { logStep("Could not close refunded consultation (non-blocking)", { error: closeErr.message }); return; }
      const chatSessionId = (closed as any)?.[0]?.chat_session_id;
      if (chatSessionId) {
        // chat_status solo admite 'active' y 'closed'.
        const { error: chatErr } = await supabaseAdmin.from("chat_sessions").update({ status: "closed" }).eq("id", chatSessionId);
        if (chatErr) logStep("Could not close refunded chat session (non-blocking)", { chatSessionId, error: chatErr.message });
      }
      logStep("Refunded consultation closed", { consultationId, closed: (closed || []).length });
    };

    // Get user profile for email
    const { data: userProfile } = await supabaseAdmin
      .from("profiles")
      .select("email, name")
      .eq("id", user_id)
      .single();

    // ========== STRIPE REFUND ==========
    if (refund_method === 'stripe' && stripe_payment_intent_id) {
      logStep("Processing Stripe refund", { paymentIntentId: stripe_payment_intent_id, amount });
      
      try {
        // La web manda a veces el id de la sesión de Checkout (cs_...), no el del
        // PaymentIntent (pi_...): Stripe rechaza el refund con ese id. Se resuelve aquí.
        let paymentIntentId: string = stripe_payment_intent_id;
        if (paymentIntentId.startsWith("cs_")) {
          const checkoutSession = await stripe.checkout.sessions.retrieve(paymentIntentId);
          const pi = checkoutSession.payment_intent;
          paymentIntentId = typeof pi === "string" ? pi : (pi?.id ?? "");
          if (!paymentIntentId) throw new Error("Checkout session has no payment intent");
          logStep("Resolved checkout session to payment intent", { sessionId: stripe_payment_intent_id, paymentIntentId });
        }
        const refund = await stripe.refunds.create({
          payment_intent: paymentIntentId,
          amount: Math.round(amount * 100),
          reason: "requested_by_customer",
        }, { idempotencyKey: refundIdemKey });

        stripeRefundId = refund.id;
        logStep("Stripe refund created", { refundId: refund.id });
      } catch (stripeError: any) {
        logStep("Stripe refund failed", { error: stripeError.message });
        // Liberar la reclamación para que el admin pueda reintentar.
        if (refund_request_id) {
          await supabaseAdmin.from("refund_requests")
            .update({ status: "pending" }).eq("id", refund_request_id).eq("status", "approved");
        }
        throw new Error(`Stripe refund failed: ${stripeError.message}`);
      }

      // Update refund request if provided
      if (refund_request_id) {
        await supabaseAdmin.from("refund_requests").update({
          status: "processed",
          refund_method: "stripe",
          stripe_refund_id: stripeRefundId,
          reviewed_by: userData.user.id,
          reviewed_at: new Date().toISOString(),
        }).eq("id", refund_request_id);
      }

      // Create refund transaction record
      const { data: stripeRefundTx } = await supabaseAdmin.from("wallet_transactions").insert({
        user_id,
        type: "refund",
        amount,
        description: reason || "Reembolso a Stripe",
        status: "paid",
        metadata: { 
          admin_id: userData.user.id,
          original_transaction_id: transaction_id,
          stripe_refund_id: stripeRefundId,
          refund_method: "stripe",
        },
      }).select("id").maybeSingle();

      // El dinero vuelve a la tarjeta: el médico tampoco debe conservar esa ganancia.
      await reverseDoctorEarnings();
      await markOriginalRefunded((stripeRefundTx as any)?.id ?? null, "stripe");
      await closeRefundedConsultation();

      // Send confirmation email
      await sendRefundEmail({ user_email: userProfile?.email, user_name: userProfile?.name, amount, refund_method: "stripe" });

      // Notify user
      await supabaseAdmin.from("notifications").insert({
        user_id,
        type: "system",
        title: "Reembolso a Stripe procesado",
        message: `Se han reembolsado $${amount.toFixed(2)} a tu tarjeta/cuenta de Stripe.`,
        data: { amount, reason, refund_method: "stripe" },
      });

      logStep("Stripe refund completed", { userId: user_id, amount });

      await supabaseAdmin.from("admin_audit_logs").insert({
        admin_id: userData.user.id,
        action: "refund_stripe",
        target_user_id: user_id,
        target_resource_id: transaction_id || null,
        target_resource_type: "wallet_transaction",
        amount,
        reason: reason || null,
        metadata: {
          stripe_payment_intent_id,
          stripe_refund_id: stripeRefundId,
          refund_request_id: refund_request_id || null,
        },
      });

      return new Response(
        JSON.stringify({ success: true, message: "Reembolso a Stripe procesado", stripe_refund_id: stripeRefundId, refund_method: "stripe" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== BANK TRANSFER REFUND ==========
    if (refund_method === 'bank_transfer') {
      // Check if user has bank account
      const { data: bankAccount } = await supabaseAdmin
        .from("user_bank_accounts")
        .select("*")
        .eq("user_id", user_id)
        .single();

      const estimatedDate = new Date();
      estimatedDate.setDate(estimatedDate.getDate() + 15);

      if (!bankAccount) {
        // No bank account - set status to awaiting_bank_details
        if (refund_request_id) {
          await supabaseAdmin.from("refund_requests").update({
            status: "awaiting_bank_details",
            refund_method: "bank_transfer",
            estimated_completion_date: estimatedDate.toISOString(),
            user_has_bank_account: false,
            reviewed_by: userData.user.id,
            reviewed_at: new Date().toISOString(),
          }).eq("id", refund_request_id);
        }

        // Send email asking user to register bank account
        await sendRefundEmail({ user_email: userProfile?.email, user_name: userProfile?.name, amount, refund_method: "awaiting_bank_details" });

        await supabaseAdmin.from("notifications").insert({
          user_id,
          type: "system",
          title: "Registra tu cuenta bancaria",
          message: `Tu reembolso de $${amount.toFixed(2)} fue aprobado. Registra tu cuenta bancaria para recibirlo.`,
          data: { amount, reason, refund_method: "awaiting_bank_details" },
        });

        return new Response(
          JSON.stringify({ success: true, message: "Esperando datos bancarios del usuario", refund_method: "awaiting_bank_details" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Has bank account - mark as pending_transfer
      if (refund_request_id) {
        await supabaseAdmin.from("refund_requests").update({
          status: "pending_transfer",
          refund_method: "bank_transfer",
          estimated_completion_date: estimatedDate.toISOString(),
          user_has_bank_account: true,
          reviewed_by: userData.user.id,
          reviewed_at: new Date().toISOString(),
        }).eq("id", refund_request_id);
      }

      // Send email with bank transfer info
      await sendRefundEmail({ 
            user_email: userProfile?.email, user_name: userProfile?.name, amount, 
            refund_method: "bank_transfer", estimated_date: estimatedDate.toLocaleDateString('es-MX') 
          });

      await supabaseAdmin.from("notifications").insert({
        user_id,
        type: "system",
        title: "Reembolso bancario en proceso",
        message: `Tu reembolso de $${amount.toFixed(2)} será transferido a tu cuenta bancaria en un plazo de 15 días hábiles.`,
        data: { amount, reason, refund_method: "bank_transfer", estimated_date: estimatedDate.toISOString() },
      });

      logStep("Bank transfer refund initiated", { userId: user_id, amount });

      return new Response(
        JSON.stringify({ success: true, message: "Reembolso bancario en proceso", refund_method: "bank_transfer" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== WALLET REFUND (default) ==========
    // Reverse doctor earnings if applicable
    await reverseDoctorEarnings();

    // Credit user's wallet
    const { error: rpcError } = await supabaseAdmin.rpc("credit_wallet_balance", { p_user_id: user_id, p_amount: amount });

    if (rpcError) {
      logStep("RPC fallback", { error: rpcError.message });
      const { data: wallet } = await supabaseAdmin.from("wallets").select("balance").eq("user_id", user_id).single();
      if (wallet) {
        await supabaseAdmin.from("wallets").update({ balance: Number(wallet.balance) + amount, updated_at: new Date().toISOString() }).eq("user_id", user_id);
      }
    }

    // Create refund transaction
    const { data: walletRefundTx } = await supabaseAdmin.from("wallet_transactions").insert({
      user_id, type: "refund", amount,
      description: reason || "Reembolso procesado por administrador",
      status: "paid",
      metadata: { admin_id: userData.user.id, original_transaction_id: transaction_id, refund_method: "wallet" },
    }).select("id").maybeSingle();

    // Update refund request if provided
    if (refund_request_id) {
      await supabaseAdmin.from("refund_requests").update({
        status: "processed",
        refund_method: "wallet",
        reviewed_by: userData.user.id,
        reviewed_at: new Date().toISOString(),
      }).eq("id", refund_request_id);
    }

    // Update original transaction
    await markOriginalRefunded((walletRefundTx as any)?.id ?? null, "wallet");
    await closeRefundedConsultation();

    // Send email
    await sendRefundEmail({ user_email: userProfile?.email, user_name: userProfile?.name, amount, refund_method: "wallet" });

    // Notify user
    await supabaseAdmin.from("notifications").insert({
      user_id, type: "system",
      title: "Reembolso procesado",
      message: `Se ha acreditado $${amount.toFixed(2)} a tu billetera.${reason ? ` Motivo: ${reason}` : ''}`,
      data: { amount, reason, refund_method: "wallet" },
    });

    logStep("Wallet refund completed", { userId: user_id, amount });

    await supabaseAdmin.from("admin_audit_logs").insert({
      admin_id: userData.user.id,
      action: "refund_wallet",
      target_user_id: user_id,
      target_resource_id: transaction_id || null,
      target_resource_type: "wallet_transaction",
      amount,
      reason: reason || null,
      metadata: { refund_request_id: refund_request_id || null },
    });

    return new Response(
      JSON.stringify({ success: true, message: "Reembolso a billetera procesado", refund_method: "wallet" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    logStep("ERROR", { message: error.message });
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: error instanceof HttpError ? error.status : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
