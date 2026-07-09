import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { maskEmail } from "../_shared/log-redact.ts";
import { getSubscriptionPricing } from "../_shared/pricing.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

const supabaseAdmin = () => createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } }
);

Deno.serve(async (req) => {
  try {
    logStep("Webhook received");
    
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-03-31.basil" });
    const signature = req.headers.get("stripe-signature");
    const body = await req.text();

    let event: Stripe.Event;

    // SECURITY: signature verification is REQUIRED in production. No "dev mode" bypass.
    if (!webhookSecret) {
      logStep("FATAL: STRIPE_WEBHOOK_SECRET not configured");
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), { status: 500 });
    }
    if (!signature) {
      logStep("Rejected: missing stripe-signature header");
      return new Response(JSON.stringify({ error: "Missing signature" }), { status: 401 });
    }
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        webhookSecret,
        undefined,
        Stripe.createSubtleCryptoProvider()
      );
      logStep("Webhook signature verified");
    } catch (err) {
      logStep("Webhook signature verification failed", { error: err instanceof Error ? err.message : err });
      return new Response(JSON.stringify({ error: "Webhook signature verification failed" }), { status: 400 });
    }

    logStep("Event type", { type: event.type, id: event.id });

    const db = supabaseAdmin();

    // Event-level idempotency: INSERT the event.id with a UNIQUE constraint.
    // If the insert fails because the row already exists, this is a replay
    // (Stripe retries failed deliveries for up to 3 days). Skip handling
    // entirely so we never double-credit, double-renew, or double-notify.
    const { error: idempErr } = await db
      .from("stripe_webhook_events")
      .insert({ event_id: event.id, event_type: event.type, status: "processing" });

    if (idempErr) {
      const msg = (idempErr as any)?.message || String(idempErr);
      if (msg.includes("duplicate key") || (idempErr as any)?.code === "23505") {
        logStep("Replay detected — already processed, skipping", { eventId: event.id });
        return new Response(JSON.stringify({ received: true, replay: true }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      }
      // Could NOT record the idempotency marker for a non-duplicate reason
      // (transient DB error). FAIL CLOSED: return 500 so Stripe retries later.
      // Processing now — without a marker — risks double-credit/double-pay if the
      // retry also slips through, so we refuse rather than proceed unguarded.
      logStep("Failed to record idempotency marker — failing closed (will retry)", { error: msg });
      return new Response(JSON.stringify({ error: "idempotency marker unavailable" }), {
        headers: { "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Handle checkout.session.completed
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      logStep("Checkout session completed", { sessionId: session.id, metadata: session.metadata });

      if (session.metadata?.type === "wallet_topup" && session.payment_status === "paid") {
        await handleWalletTopup(db, session);
      }
      if (session.metadata?.type === "recording_purchase" && session.payment_status === "paid") {
        await handleRecordingPurchase(db, session);
      }
      if (session.metadata?.type === "content_purchase" && session.payment_status === "paid") {
        await handleContentPurchase(db, session);
      }
      if (session.metadata?.type === "creator_subscription" && session.payment_status === "paid") {
        await handleCreatorSubscription(db, session);
      }
      if (session.metadata?.type === "consultation_payment" && session.payment_status === "paid") {
        await handleConsultationPayment(db, session);
      }
      if (session.metadata?.type === "double_check_payment" && session.payment_status === "paid") {
        await handleConsultationPayment(db, session, true);
      }
      if (session.metadata?.type === "live_consultation_payment" && session.payment_status === "paid") {
        await handleConsultationPayment(db, session, false, true);
      }
      if (session.metadata?.type === "storage_upgrade" && session.payment_status === "paid") {
        await handleStorageUpgrade(db, session);
      }
      if (session.metadata?.type === "live_chat_highlight" && session.payment_status === "paid") {
        await handleLiveChatHighlight(db, session);
      }
      if (session.metadata?.type === "marketplace_purchase" && session.payment_status === "paid") {
        await handleMarketplacePurchase(db, session);
      }
      if (session.metadata?.type === "marketplace_interest_fee" && session.payment_status === "paid") {
        await handleMarketplaceInterestFee(db, session);
      }
      if (session.metadata?.type === "marketplace_sale_fee" && session.payment_status === "paid") {
        await handleMarketplaceSaleFee(db, session);
      }
      if (session.metadata?.type === "ad_campaign" && session.payment_status === "paid") {
        await handleAdPurchaseCompleted(db, session);
      }
    }

    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as Stripe.Invoice;
      await handleInvoicePaymentSucceeded(db, stripe, invoice);
    }

    // FIX #2: Handle subscription cancellations - fetch customer from Stripe API
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionDeleted(db, stripe, subscription);
    }

    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account;
      await handleAccountUpdated(db, account);
    }

    // Stripe sends checkout.session.expired ~30min after creation if the user
    // never paid. For marketplace orders this means the reserved stock must
    // be restored, otherwise abandoned checkouts permanently lock inventory.
    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.type === "marketplace_purchase") {
        await handleMarketplaceCheckoutExpired(db, session);
      }
      if (session.metadata?.type === "ad_campaign") {
        await handleAdCheckoutExpired(db, session);
      }
    }

    // Handle payout events (Stripe sends payout.paid/payout.failed for bank transfers)
    if (event.type === "payout.paid") {
      const payout = event.data.object as Stripe.Payout;
      await handlePayoutPaid(db, payout);
    }

    if (event.type === "payout.failed") {
      const payout = event.data.object as Stripe.Payout;
      await handlePayoutFailed(db, stripe, payout);
    }

    // Handle transfer events (transfer.created/updated for Connect transfers)
    if (event.type === "transfer.created" || event.type === "transfer.updated") {
      const transfer = event.data.object as Stripe.Transfer;
      await handleTransferUpdate(db, transfer);
    }

    // Marketplace: chargeback / dispute opened
    if (event.type === "charge.dispute.created" || event.type === "charge.dispute.updated" || event.type === "charge.dispute.closed") {
      const dispute = event.data.object as Stripe.Dispute;
      try {
        const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
        let orderId: string | null = null;
        if (chargeId) {
          const charge = await stripe.charges.retrieve(chargeId);
          const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
          if (piId) {
            const { data: ord } = await db
              .from("marketplace_orders")
              .select("id")
              .eq("stripe_payment_intent_id", piId)
              .maybeSingle();
            orderId = ord?.id || null;
          }
        }
        await db.from("order_disputes").upsert({
          stripe_dispute_id: dispute.id,
          stripe_charge_id: chargeId || null,
          order_id: orderId,
          amount: dispute.amount / 100,
          currency: (dispute.currency || "mxn").toUpperCase(),
          reason: dispute.reason,
          status: dispute.status,
          evidence_due_by: dispute.evidence_details?.due_by ? new Date(dispute.evidence_details.due_by * 1000).toISOString() : null,
          raw: dispute as any,
          updated_at: new Date().toISOString(),
        }, { onConflict: "stripe_dispute_id" });

        if (orderId) {
          await db.from("marketplace_orders").update({
            dispute_status: dispute.status,
          }).eq("id", orderId);
        }
        logStep("Dispute upserted", { id: dispute.id, status: dispute.status, orderId });
      } catch (e: any) {
        logStep("Dispute handler error", { error: e.message });
      }
    }

    // Marketplace: refund created/updated/failed via Stripe Dashboard (not just our API)
    if (event.type === "charge.refunded" || event.type === "refund.updated" || event.type === "refund.failed") {
      const refundObj = event.data.object as any;
      try {
        const stripeRefundId = refundObj.id?.startsWith("re_") ? refundObj.id : refundObj.refunds?.data?.[0]?.id;
        if (stripeRefundId) {
          const status = refundObj.status === "succeeded" || event.type === "charge.refunded" ? "refunded" : refundObj.status || "processing";
          await db
            .from("order_refunds")
            .update({ status, refunded_at: status === "refunded" ? new Date().toISOString() : null })
            .eq("stripe_refund_id", stripeRefundId);
          logStep("Refund webhook synced", { id: stripeRefundId, status });
        }
      } catch (e: any) {
        logStep("Refund webhook error", { error: e.message });
      }
    }

    // Mark idempotency row as processed so we have a healthy audit trail.
    await db
      .from("stripe_webhook_events")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("event_id", event.id);

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    // Best-effort: mark this event as failed so retries can detect prior errors
    try {
      const db = supabaseAdmin();
      const sigHeader = req.headers.get("stripe-signature") || "";
      const evId = sigHeader.match(/v1=([a-f0-9]+)/)?.[1]; // not the event id, but best we have
      if (evId) {
        await db.from("stripe_webhook_events").update({ status: "failed", error: errorMessage }).eq("event_id", evId);
      }
    } catch {}
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});

// Handler functions

async function handleWalletTopup(db: ReturnType<typeof supabaseAdmin>, session: Stripe.Checkout.Session) {
  const userId = session.metadata!.user_id;
  const amount = parseFloat(session.metadata!.amount);
  
  logStep("Processing wallet topup", { userId, amount });

  // Check for duplicate processing (idempotency)
  const { data: existingTx } = await db
    .from("wallet_transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "topup")
    .eq("status", "paid")
    .contains("metadata", { stripe_session_id: session.id })
    .maybeSingle();

  if (existingTx) {
    logStep("Topup already processed, skipping", { sessionId: session.id });
    return;
  }

  const { error: txError } = await db
    .from("wallet_transactions")
    .insert({
      user_id: userId,
      type: "topup",
      amount: amount,
      description: `Recarga via Stripe - ${session.id}`,
      status: "paid",
      metadata: { stripe_session_id: session.id },
    });

  if (txError) {
    logStep("Error creating transaction", { error: txError });
    throw txError;
  }

  // Atomic balance update using RPC to prevent race conditions
  const { error: rpcError } = await db.rpc("credit_wallet_balance", {
    p_user_id: userId,
    p_amount: amount,
  });

  if (rpcError) {
    logStep("CRITICAL: RPC credit_wallet_balance failed", { error: rpcError.message });
    throw new Error(`Failed to credit wallet atomically: ${rpcError.message}`);
  }
  
  logStep("Wallet topup completed", { userId, amount });

  // Send confirmation email (legal requirement)
  try {
    const { data: userProfile } = await db
      .from("profiles")
      .select("email, name")
      .eq("id", userId)
      .single();

    if (userProfile?.email) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      await fetch(`${supabaseUrl}/functions/v1/send-purchase-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          email: userProfile.email,
          name: userProfile.name || 'Usuario',
          productName: 'Recarga de Wallet',
          amount: amount,
          currency: 'MXN',
        }),
      });
      logStep("Wallet topup confirmation email sent", { userId, email: maskEmail(userProfile.email) });
    }
  } catch (emailErr) {
    logStep("Error sending topup confirmation email (non-critical)", { error: emailErr instanceof Error ? emailErr.message : emailErr });
  }
}

async function handleRecordingPurchase(db: ReturnType<typeof supabaseAdmin>, session: Stripe.Checkout.Session) {
  const userId = session.metadata!.user_id;
  const recordingId = session.metadata!.recording_id;
  const amount = parseFloat(session.metadata!.amount);
  
  logStep("Processing recording purchase", { userId, recordingId, amount });

  const { error: purchaseError } = await db
    .from("purchases")
    .insert({
      user_id: userId,
      recording_id: recordingId,
      amount: amount,
    });

  if (purchaseError) {
    logStep("Error creating purchase", { error: purchaseError });
    return;
  }

  logStep("Purchase recorded successfully", { userId, recordingId });

  const { data: recording } = await db
    .from("recordings")
    .select("doctor_id")
    .eq("id", recordingId)
    .single();

  if (recording?.doctor_id) {
    // FIX #1: Use atomic credit function
    await creditDoctorEarningsAtomic(db, recording.doctor_id, amount, "recording", recordingId);

    // Notificar al doctor: "te compraron contenido" — el frontend usa
    // notification.type + data.recording_id para llevarlo a la grabación.
    try {
      const { data: rec } = await db
        .from("recordings")
        .select("title")
        .eq("id", recordingId)
        .maybeSingle();
      const { data: buyerProfile } = await db
        .from("profiles")
        .select("name")
        .eq("id", userId)
        .maybeSingle();
      const buyerName = buyerProfile?.name || "Un usuario";
      const title = rec?.title || "tu grabación";
      await db.from("notifications").insert({
        user_id: recording.doctor_id,
        type: "recording_purchase",
        title: "Nueva compra de contenido",
        message: `${buyerName} compró "${title}" por $${amount.toFixed(2)} MXN`,
        data: { recording_id: recordingId, buyer_id: userId, amount },
      });
    } catch (e: any) {
      logStep("Failed to notify doctor of purchase", { error: e.message });
    }
  }
}

// Libros/cursos PDF de pago (doctor_content.is_book) — espejo de handleRecordingPurchase
async function handleContentPurchase(db: ReturnType<typeof supabaseAdmin>, session: Stripe.Checkout.Session) {
  const userId = session.metadata!.user_id;
  const contentId = session.metadata!.content_id;
  const amount = parseFloat(session.metadata!.amount);

  logStep("Processing content purchase", { userId, contentId, amount });

  const { error: purchaseError } = await db
    .from("purchases")
    .insert({
      user_id: userId,
      content_id: contentId,
      amount: amount,
    });

  if (purchaseError) {
    logStep("Error creating content purchase", { error: purchaseError });
    return;
  }

  logStep("Content purchase recorded successfully", { userId, contentId });

  await db
    .from('entitlements')
    .insert({
      user_id: userId,
      type: `content_${contentId}`,
      is_active: true,
    });

  const { data: content } = await db
    .from("doctor_content")
    .select("creator_id, title")
    .eq("id", contentId)
    .single();

  if (content?.creator_id) {
    await creditDoctorEarningsAtomic(db, content.creator_id, amount, "content", contentId);

    try {
      const { data: buyerProfile } = await db
        .from("profiles")
        .select("name")
        .eq("id", userId)
        .maybeSingle();
      const buyerName = buyerProfile?.name || "Un usuario";
      const title = content.title || "tu libro";
      await db.from("notifications").insert({
        user_id: content.creator_id,
        type: "content_purchase",
        title: "Nueva venta de libro/curso",
        message: `${buyerName} compró "${title}" por $${amount.toFixed(2)} MXN`,
        data: { content_id: contentId, buyer_id: userId, amount },
      });
    } catch (e: any) {
      logStep("Failed to notify doctor of content purchase", { error: e.message });
    }
  }
}

async function handleCreatorSubscription(db: ReturnType<typeof supabaseAdmin>, session: Stripe.Checkout.Session) {
  const userId = session.metadata!.user_id;
  const creatorId = session.metadata!.creator_id;
  const tier = session.metadata!.tier as "basic" | "premium";
  
  logStep("Processing creator subscription", { userId, creatorId, tier });

  // Admin-editable price (same site_settings.subscription_pricing as checkout),
  // converted cents→pesos; falls back to $99/$199 if the setting is missing.
  const pricing = await getSubscriptionPricing(db);
  const tierPrice = (tier === "premium" ? pricing.premium_cents : pricing.basic_cents) / 100;
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 1);

  const { data: existingSub } = await db
    .from("subscriptions")
    .select("id")
    .eq("subscriber_id", userId)
    .eq("creator_id", creatorId)
    .single();

  if (existingSub) {
    await db
      .from("subscriptions")
      .update({
        tier,
        price_paid: tierPrice,
        is_active: true,
        expires_at: expiresAt.toISOString(),
      })
      .eq("id", existingSub.id);
    logStep("Subscription upgraded", { userId, creatorId, tier });
  } else {
    await db
      .from("subscriptions")
      .insert({
        subscriber_id: userId,
        creator_id: creatorId,
        tier,
        price_paid: tierPrice,
        is_active: true,
        expires_at: expiresAt.toISOString(),
      });
    logStep("Subscription created", { userId, creatorId, tier });
  }

  const { data: subscriberProfile } = await db
    .from("profiles")
    .select("name")
    .eq("id", userId)
    .single();

  await db
    .from("notifications")
    .insert({
      user_id: creatorId,
      type: "subscription_update",
      title: "¡Nuevo suscriptor!",
      message: `${subscriberProfile?.name || "Un usuario"} se suscribió a tu plan ${tier}`,
      data: { subscriber_id: userId, tier },
    });

  // FIX #1: Use atomic credit function
  await creditDoctorEarningsAtomic(db, creatorId, tierPrice, "subscription", null);
}

async function handleConsultationPayment(db: ReturnType<typeof supabaseAdmin>, session: Stripe.Checkout.Session, isDoubleCheck = false, isLive = false) {
  const userId = session.metadata!.user_id;
  const doctorId = session.metadata!.doctor_id;
  const finalFee = parseFloat(session.metadata!.final_fee);
  const fileIds = isDoubleCheck
    ? (session.metadata?.file_ids || "").split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const liveId = isLive ? (session.metadata?.live_id || null) : null;
  const liveMessage = isLive ? (session.metadata?.live_message || "") : "";

  logStep("Processing consultation payment", { userId, doctorId, finalFee, isDoubleCheck, isLive, files: fileIds.length });

  // Idempotency: a Stripe replay (or a stuck-'processing' re-run) must not
  // create a second consultation, double-debit the patient, or double-credit
  // the doctor. The patient debit below is tagged with stripe_session_id.
  const { data: dupTx } = await db
    .from("wallet_transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "purchase")
    .contains("metadata", { stripe_session_id: session.id })
    .maybeSingle();
  if (dupTx) {
    logStep("Consultation payment already processed, skipping", { sessionId: session.id });
    return;
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const { error: entitlementError } = await db
    .from("entitlements")
    .insert({
      user_id: userId,
      type: isDoubleCheck ? "double_check" : "chat",
      is_active: true,
      expires_at: expiresAt.toISOString(),
    });

  if (entitlementError) {
    logStep("Error creating entitlement", { error: entitlementError });
  } else {
    logStep("Entitlement created", { userId, expiresAt, type: isDoubleCheck ? "double_check" : "chat" });
  }

  const { data: patientRole } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();

  const { data: existingSession } = await db
    .from("chat_sessions")
    .select("id")
    .or(`and(participant1_id.eq.${userId},participant2_id.eq.${doctorId}),and(participant1_id.eq.${doctorId},participant2_id.eq.${userId})`)
    .eq("status", "active")
    .eq("is_double_check", isDoubleCheck)
    .maybeSingle();

  let chatSessionId = existingSession?.id;

  if (!chatSessionId) {
    const { data: newSession, error: sessionError } = await db
      .from("chat_sessions")
      .insert({
        participant1_id: userId,
        participant1_type: patientRole?.role || "patient",
        participant2_id: doctorId,
        participant2_type: "doctor",
        status: "active",
        is_double_check: isDoubleCheck,
      })
      .select()
      .single();

    if (sessionError) {
      logStep("Error creating chat session", { error: sessionError });
    } else {
      chatSessionId = newSession.id;
      logStep("Chat session created", { sessionId: chatSessionId });
    }
  }

  const { data: consultation, error: consultationError } = await db
    .from("consultations")
    .insert({
      patient_id: userId,
      doctor_id: doctorId,
      chat_session_id: chatSessionId,
      status: "active",
    })
    .select()
    .single();

  if (consultationError) {
    logStep("Error creating consultation record", { error: consultationError });
  } else {
    logStep("Consultation record created", { consultationId: consultation.id });
  }

  // Segunda opinión: compartir los estudios seleccionados con el médico (mismo
  // efecto que grantAccess en el path wallet: fila en vault_access por archivo).
  if (isDoubleCheck && fileIds.length > 0) {
    const { error: grantError } = await db
      .from("vault_access")
      .insert(fileIds.map((fid) => ({ file_id: fid, doctor_id: doctorId })));
    if (grantError) {
      logStep("Error granting vault access for double-check", { error: grantError });
    } else {
      logStep("Vault access granted for double-check", { files: fileIds.length });
    }
  }

  // Reserva desde un live pagada con tarjeta: replica los efectos del path wallet
  // (book_live_consultation) que antes se perdían — mensaje inicial, registro de la
  // orientación y conteo del límite del live.
  if (isLive && liveId) {
    if (liveMessage && chatSessionId) {
      await db.from("chat_messages").insert({
        session_id: chatSessionId,
        sender_id: userId,
        content: `📋 Mensaje desde el live: ${liveMessage}`,
      });
    }
    await db.from("live_consultation_requests").insert({
      live_id: liveId,
      patient_id: userId,
      doctor_id: doctorId,
      message: liveMessage,
      payment_method: "card",
      amount: finalFee,
      chat_session_id: chatSessionId,
      consultation_id: consultation?.id,
      status: "completed",
    });
    // Cuenta la orientación contra el límite del live (max_paid_chats).
    const { error: incErr } = await db.rpc("increment_live_paid_chats", { p_live_id: liveId });
    if (incErr) {
      // Fallback si la RPC no existe: incremento no atómico best-effort.
      const { data: lr } = await db.from("lives").select("paid_chats_count").eq("id", liveId).maybeSingle();
      await db.from("lives").update({ paid_chats_count: Number(lr?.paid_chats_count || 0) + 1 }).eq("id", liveId);
    }
    await db.from("notifications").insert({
      user_id: doctorId,
      type: "chat_message",
      title: "🎯 Nueva orientación desde tu Live",
      message: "Un paciente reservó una orientación desde tu transmisión en vivo",
      data: { patient_id: userId, url: "/chat", session_id: chatSessionId, source: "live", live_id: liveId },
    });
  }

  // FIX #1: Use atomic credit function
  await creditDoctorEarningsAtomic(db, doctorId, finalFee, "consultation", null);

  await db
    .from("wallet_transactions")
    .insert({
      user_id: userId,
      type: "purchase",
      amount: -finalFee,
      description: isDoubleCheck ? "Segunda opinión médica por chat" : (isLive ? "Orientación desde live por chat" : "Consulta médica por chat"),
      status: "paid",
      metadata: { type: isDoubleCheck ? "double_check" : (isLive ? "live_consultation" : "consultation"), doctor_id: doctorId, stripe_session_id: session.id, consultation_id: consultation?.id },
    });

  const { data: patientProfile } = await db
    .from("profiles")
    .select("name")
    .eq("id", userId)
    .single();

  await db
    .from("notifications")
    .insert({
      user_id: userId,
      type: "system",
      title: "Pago exitoso",
      message: "Tu consulta ha sido pagada. Ya puedes iniciar el chat con tu médico.",
      data: { doctor_id: doctorId, session_id: chatSessionId },
    });

  await db
    .from("notifications")
    .insert({
      user_id: doctorId,
      type: "chat_message",
      title: "💬 Nueva consulta pagada",
      message: `${patientProfile?.name || "Un paciente"} ha pagado una consulta contigo`,
      data: { 
        patient_id: userId, 
        session_id: chatSessionId,
        url: "/chat"
      },
    });

  logStep("Consultation payment processed successfully", { userId, doctorId, chatSessionId });
}

// FIX #1: Atomic credit function using DB function to prevent race conditions
async function creditDoctorEarningsAtomic(
  db: ReturnType<typeof supabaseAdmin>,
  doctorId: string,
  amount: number,
  source: string,
  referenceId: string | null
) {
  logStep("Crediting doctor earnings (atomic)", { doctorId, amount, source });

  // Use the atomic DB function instead of read-then-write.
  // Acredita el NETO: la comisión por-tipo se aplica aquí, al concretarse la
  // venta. `source` (consultation/recording/subscription/live_chat_highlight)
  // determina el % vía fn_commission_rate.
  const { data: newPending, error: rpcError } = await db.rpc("credit_doctor_earnings", {
    p_doctor_id: doctorId,
    p_amount: amount,
    p_sale_type: source,
  });

  if (rpcError || newPending === -1) {
    logStep("Error crediting earnings atomically", { error: rpcError, doctorId });
    return;
  }

  logStep("Doctor earnings credited atomically", { doctorId, amount, newPending, source });

  // Create earning transaction record
  await db
    .from("wallet_transactions")
    .insert({
      user_id: doctorId,
      type: "earning",
      amount: amount,
      description: `Ganancia por ${source === "recording" ? "venta de grabación" : source === "consultation" ? "consulta médica" : source === "subscription_renewal" ? "renovación de suscripción" : source === "content" ? "venta de libro/curso" : "suscripción"}`,
      status: "paid",
      metadata: { source, reference_id: referenceId },
    });
}

async function handleStorageUpgrade(db: ReturnType<typeof supabaseAdmin>, session: Stripe.Checkout.Session) {
  const userId = session.metadata!.user_id;
  const extraGB = parseInt(session.metadata!.extra_gb);
  const amount = parseFloat(session.metadata!.amount);

  logStep("Processing storage upgrade", { userId, extraGB, amount });

  // Idempotency check
  const { data: existingTx } = await db
    .from("wallet_transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "purchase")
    .contains("metadata", { stripe_session_id: session.id })
    .maybeSingle();

  if (existingTx) {
    logStep("Storage upgrade already processed, skipping", { sessionId: session.id });
    return;
  }

  // Update storage limit
  const { data: profile } = await db
    .from("profiles")
    .select("storage_limit_bytes")
    .eq("id", userId)
    .single();

  const currentLimit = profile?.storage_limit_bytes || 1073741824;
  const newLimit = currentLimit + (extraGB * 1073741824);

  await db
    .from("profiles")
    .update({ storage_limit_bytes: newLimit })
    .eq("id", userId);

  // Record transaction
  await db
    .from("wallet_transactions")
    .insert({
      user_id: userId,
      type: "purchase",
      amount: -amount,
      description: `Expansión de almacenamiento: +${extraGB}GB (Stripe)`,
      status: "paid",
      metadata: { type: "storage_upgrade", extra_gb: extraGB, stripe_session_id: session.id },
    });

  logStep("Storage upgrade completed", { userId, extraGB, newLimit });
}


async function handleAccountUpdated(db: ReturnType<typeof supabaseAdmin>, account: Stripe.Account) {
  logStep("Account updated", { accountId: account.id, payoutsEnabled: account.payouts_enabled });

  const { data: bankAccount } = await db
    .from("doctor_bank_accounts")
    .select("doctor_id")
    .eq("stripe_account_id", account.id)
    .maybeSingle();

  if (!bankAccount) {
    logStep("No bank account found for Stripe account", { accountId: account.id });
    return;
  }

  let status = "pending";
  if (account.details_submitted && account.payouts_enabled) {
    status = "active";
  } else if (account.requirements?.disabled_reason) {
    status = "restricted";
  } else if (account.details_submitted) {
    status = "pending_verification";
  }

  await db
    .from("doctor_bank_accounts")
    .update({
      stripe_account_status: status,
      payouts_enabled: account.payouts_enabled || false,
      onboarding_completed: account.details_submitted || false,
      is_verified: account.payouts_enabled || false,
    })
    .eq("stripe_account_id", account.id);

  await db
    .from("doctor_profiles")
    .update({
      payouts_enabled: account.payouts_enabled || false,
    })
    .eq("user_id", bankAccount.doctor_id);

  logStep("Account status updated", { doctorId: bankAccount.doctor_id, status });

  // If Stripe restricted the account, surface that to the doctor in-app
  // immediately. Without this they discover the freeze only when a payout
  // fails — often weeks later.
  if (status === "restricted") {
    const disabledReason = account.requirements?.disabled_reason || "verification_pending";
    const currentlyDue = (account.requirements?.currently_due || []).slice(0, 5).join(", ");
    try {
      await db.from("notifications").insert({
        user_id: bankAccount.doctor_id,
        type: "system",
        title: "⚠️ Cuenta de cobros restringida",
        message: `Stripe ha restringido tus pagos: ${disabledReason}.${currentlyDue ? ` Faltan: ${currentlyDue}.` : ""} Completa la verificación en Configuración para reactivar tus payouts.`,
        data: {
          stripe_account_id: account.id,
          disabled_reason: disabledReason,
          currently_due: account.requirements?.currently_due || [],
          url: "/doctor/payouts",
        },
      });
    } catch (e) {
      logStep("Failed to insert restricted notification", { error: e instanceof Error ? e.message : e });
    }
  }
}

// Handle transfer.created/updated - mark payout as processing or completed
async function handleTransferUpdate(db: ReturnType<typeof supabaseAdmin>, transfer: Stripe.Transfer) {
  logStep("Transfer update", { transferId: transfer.id, reversed: transfer.reversed });

  // If transfer was reversed, treat it like a failure
  if (transfer.reversed) {
    const doctorId = transfer.metadata?.doctor_id;
    if (doctorId) {
      const grossAmount = parseFloat(transfer.metadata?.gross_amount || "0");
      if (grossAmount > 0) {
        // Reverso de un payout: se re-acredita en CRUDO lo que se había
        // descontado (ya neto). No volver a aplicar comisión.
        await db.rpc("credit_doctor_earnings", {
          p_doctor_id: doctorId,
          p_amount: grossAmount,
          p_apply_commission: false,
        });

        const { data: profile } = await db
          .from("doctor_profiles")
          .select("total_earnings")
          .eq("user_id", doctorId)
          .single();

        if (profile) {
          await db
            .from("doctor_profiles")
            .update({ total_earnings: Math.max(0, (profile.total_earnings || 0) - grossAmount) })
            .eq("user_id", doctorId);
        }

        logStep("Reversed earnings for reversed transfer", { doctorId, grossAmount });
      }
    }

    await db
      .from("doctor_payouts")
      .update({ status: "failed", error_message: "Transfer reversed" })
      .eq("stripe_transfer_id", transfer.id);
  } else {
    // Transfer completed successfully - mark as paid
    const { data: existingPayout } = await db
      .from("doctor_payouts")
      .select("status")
      .eq("stripe_transfer_id", transfer.id)
      .maybeSingle();

    if (existingPayout && existingPayout.status === "processing") {
      await db
        .from("doctor_payouts")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("stripe_transfer_id", transfer.id);

      logStep("Payout marked as paid via transfer update", { transferId: transfer.id });
    }
  }
}

// Handle payout.paid - funds arrived in connected account's bank
async function handlePayoutPaid(db: ReturnType<typeof supabaseAdmin>, payout: Stripe.Payout) {
  logStep("Payout paid", { payoutId: payout.id, destination: payout.destination });

  // Stripe payouts go from connected account to bank
  // We track via stripe_payout_id if set
  const { error } = await db
    .from("doctor_payouts")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("stripe_payout_id", payout.id);

  if (error) {
    logStep("Error updating payout status for payout.paid", { error });
  } else {
    logStep("Payout marked as paid", { payoutId: payout.id });
  }
}

// Handle payout.failed - bank transfer failed
async function handlePayoutFailed(
  db: ReturnType<typeof supabaseAdmin>,
  stripe: Stripe,
  payout: Stripe.Payout
) {
  logStep("Payout failed", { payoutId: payout.id, failureMessage: payout.failure_message });

  const { error } = await db
    .from("doctor_payouts")
    .update({
      status: "failed",
      error_message: payout.failure_message || "Bank payout failed",
    })
    .eq("stripe_payout_id", payout.id);

  if (error) {
    logStep("Error updating payout status for payout.failed", { error });
  } else {
    logStep("Payout marked as failed", { payoutId: payout.id });
  }
}

async function handleInvoicePaymentSucceeded(db: ReturnType<typeof supabaseAdmin>, stripe: Stripe, invoice: Stripe.Invoice) {
  if (!invoice.subscription || invoice.billing_reason === 'subscription_create') {
    logStep("Skipping invoice - not a renewal", { reason: invoice.billing_reason });
    return;
  }

  logStep("Processing subscription renewal", {
    subscriptionId: invoice.subscription,
    customerId: invoice.customer,
    invoiceId: invoice.id,
  });

  // Fetch the actual Stripe subscription so we can use its real
  // current_period_end timestamp. Doing local "+1 month" math drifts a day or
  // two over Stripe's calendar and eventually creates gaps/overlaps.
  let stripeSub: Stripe.Subscription | null = null;
  try {
    const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id;
    stripeSub = await stripe.subscriptions.retrieve(subId);
  } catch (e) {
    logStep("Could not retrieve subscription from Stripe, will fall back to +1 month", { error: e instanceof Error ? e.message : e });
  }

  // ── Idempotency: each invoice credits the doctor exactly once. A Stripe
  // replay of invoice.payment_succeeded must NOT re-credit. The renewal earning
  // is tagged with reference_id = invoice.id, so its presence = already done.
  if (invoice.id) {
    const { data: alreadyCredited } = await db
      .from("wallet_transactions")
      .select("id")
      .eq("type", "earning")
      .contains("metadata", { source: "subscription_renewal", reference_id: invoice.id })
      .maybeSingle();
    if (alreadyCredited) {
      logStep("Renewal already processed for this invoice, skipping", { invoiceId: invoice.id });
      return;
    }
  }

  // Identify the EXACT (subscriber, creator) from the Stripe subscription
  // metadata (set in create-subscription-checkout.subscription_data.metadata).
  // This stops the old bug where one invoice credited every creator the user
  // was subscribed to, and works even when invoice.customer_email is null.
  const subMeta = (stripeSub?.metadata ?? {}) as Record<string, string>;
  let userId: string | undefined = subMeta.user_id;
  const creatorId: string | undefined = subMeta.creator_id;

  // Legacy fallback: subscriptions created before metadata was attached.
  if (!userId) {
    let customerEmail: string | null = invoice.customer_email;
    if (!customerEmail) {
      try {
        const custId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (custId) {
          const cust = await stripe.customers.retrieve(custId);
          if (cust && !(cust as any).deleted) customerEmail = (cust as Stripe.Customer).email;
        }
      } catch (e) {
        logStep("Could not retrieve customer for email", { error: e instanceof Error ? e.message : e });
      }
    }
    if (!customerEmail) { logStep("No customer email; cannot match subscription"); return; }
    const { data: profile } = await db.from("profiles").select("id").eq("email", customerEmail).single();
    if (!profile) { logStep("User not found for email", { email: maskEmail(customerEmail) }); return; }
    userId = profile.id;
  }

  let subQuery = db
    .from("subscriptions")
    .select("*")
    .eq("subscriber_id", userId)
    .eq("is_active", true);
  if (creatorId) subQuery = subQuery.eq("creator_id", creatorId);
  const { data: subscriptions, error: subError } = await subQuery;

  if (subError || !subscriptions || subscriptions.length === 0) {
    logStep("No matching active subscription found", { userId, creatorId });
    return;
  }

  for (const sub of subscriptions) {
    // Prefer Stripe's current_period_end (authoritative). Fall back to +1
    // month if we couldn't fetch the subscription for any reason.
    const newExpiresAt = stripeSub?.current_period_end
      ? new Date(stripeSub.current_period_end * 1000)
      : (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d; })();

    await db
      .from("subscriptions")
      .update({
        expires_at: newExpiresAt.toISOString(),
        is_active: true,
      })
      .eq("id", sub.id);

    logStep("Subscription renewed", { subscriptionId: sub.id, newExpiresAt });

    // Safe under Stripe replay: the invoice.id idempotency guard at the top of
    // this handler returns early if this invoice already produced a renewal
    // earning, so we never reach this credit twice for the same invoice.
    await creditDoctorEarningsAtomic(db, sub.creator_id, sub.price_paid, "subscription_renewal", invoice.id || null);

    await db
      .from("notifications")
      .insert({
        user_id: sub.creator_id,
        type: "subscription_update",
        title: "🔄 Suscripción renovada",
        message: `Un suscriptor ha renovado su suscripción ${sub.tier}`,
        data: { subscriber_id: userId, tier: sub.tier, invoice_id: invoice.id },
      });
  }
}

// FIX #2: Properly fetch customer email from Stripe API instead of accessing .email on string ID
async function handleSubscriptionDeleted(
  db: ReturnType<typeof supabaseAdmin>,
  stripe: Stripe,
  subscription: Stripe.Subscription
) {
  logStep("Processing subscription cancellation", { subscriptionId: subscription.id });

  // subscription.customer is a string ID, NOT an object with .email
  // We must fetch the customer from Stripe to get the email
  let customerEmail: string | null = null;
  
  try {
    const customerId = typeof subscription.customer === 'string' 
      ? subscription.customer 
      : subscription.customer.id;
    
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) {
      logStep("Customer was deleted", { customerId });
      return;
    }
    customerEmail = customer.email;
  } catch (err) {
    logStep("Error fetching customer from Stripe", { error: err });
    return;
  }

  if (!customerEmail) {
    logStep("No customer email found for cancelled subscription");
    return;
  }

  // Find user by email
  const { data: profile } = await db
    .from("profiles")
    .select("id")
    .eq("email", customerEmail)
    .maybeSingle();

  if (!profile) {
    logStep("User not found for cancelled subscription", { email: maskEmail(customerEmail) });
    return;
  }

  // Also match by creator_id from subscription metadata if available
  const creatorId = subscription.metadata?.creator_id;
  
  let query = db
    .from("subscriptions")
    .update({ is_active: false })
    .eq("subscriber_id", profile.id)
    .eq("is_active", true);
  
  if (creatorId) {
    query = query.eq("creator_id", creatorId);
  }

  const { data: subs } = await query.select();

  if (subs && subs.length > 0) {
    for (const sub of subs) {
      await db
        .from("notifications")
        .insert({
          user_id: sub.creator_id,
          type: "subscription_update",
          title: "❌ Suscripción cancelada",
          message: `Un suscriptor ha cancelado su suscripción ${sub.tier}`,
          data: { subscriber_id: profile.id, tier: sub.tier },
        });
    }
    logStep("Subscriptions deactivated", { count: subs.length, userId: profile.id });
  }
}

async function handleLiveChatHighlight(db: ReturnType<typeof supabaseAdmin>, session: Stripe.Checkout.Session) {
  const liveId = session.metadata!.live_id;
  const userId = session.metadata!.user_id;
  const userName = session.metadata!.user_name || "Usuario";
  const messageContent = session.metadata!.message_content;
  const highlightSeconds = parseInt(session.metadata!.highlight_seconds || "120");

  logStep("Processing live chat highlight", { liveId, userId, highlightSeconds });

  // Idempotency: check if message already inserted for this session
  const { data: existingMsg } = await db
    .from("live_chat_messages")
    .select("id")
    .eq("live_id", liveId)
    .eq("user_id", userId)
    .eq("content", messageContent)
    .eq("is_paid", true)
    .limit(1)
    .maybeSingle();

  if (existingMsg) {
    logStep("Chat highlight already processed, skipping", { sessionId: session.id });
    return;
  }

  // Calculate elapsed seconds from live start
  const { data: liveData } = await db
    .from("lives")
    .select("started_at")
    .eq("id", liveId)
    .single();

  const elapsed = liveData
    ? Math.max(0, Math.floor((Date.now() - new Date(liveData.started_at).getTime()) / 1000))
    : 0;

  const highlightUntil = new Date(Date.now() + highlightSeconds * 1000).toISOString();

  const { error: insertError } = await db
    .from("live_chat_messages")
    .insert({
      live_id: liveId,
      user_id: userId,
      user_name: userName,
      content: messageContent,
      elapsed_seconds: elapsed,
      is_paid: true,
      highlight_until: highlightUntil,
    });

  if (insertError) {
    logStep("Error inserting highlighted chat message", { error: insertError });
    throw insertError;
  }

  // Credit doctor earnings
  const { data: live } = await db
    .from("lives")
    .select("doctor_id, chat_price")
    .eq("id", liveId)
    .single();

  if (live?.doctor_id) {
    const amount = Number(live.chat_price) || parseFloat(session.metadata!.amount || "0");
    if (amount > 0) {
      await creditDoctorEarningsAtomic(db, live.doctor_id, amount, "live_chat_highlight", liveId);
    }
  }

  // Atomic increment for paid_chats_count
  await db
    .from("lives")
    .update({ paid_chats_count: db.rpc ? undefined : 0 })
    .eq("id", liveId);
  
  // Use direct SQL-style atomic increment
  const { error: incError } = await db.rpc("increment_paid_chats_count", { p_live_id: liveId });
  if (incError) {
    // Fallback: direct update (less safe but functional)
    logStep("RPC increment_paid_chats_count not available, using direct update");
    await db
      .from("lives")
      .update({ paid_chats_count: (await db.from("lives").select("paid_chats_count").eq("id", liveId).single()).data?.paid_chats_count + 1 || 1 })
      .eq("id", liveId);
  }

  logStep("Live chat highlight processed successfully", { liveId, userId });
}

async function handleMarketplacePurchase(db: ReturnType<typeof supabaseAdmin>, session: Stripe.Checkout.Session) {
  const buyerId = session.metadata!.buyer_id;
  const productId = session.metadata!.product_id;
  const totalAmount = parseFloat(session.metadata!.total_amount);

  logStep("Processing marketplace purchase", { buyerId, productId, totalAmount });

  // Update order status to paid
  const { data: order } = await db
    .from("marketplace_orders")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("stripe_session_id", session.id)
    .select("id, shipping_city")
    .single();

  // Get product name for email
  const { data: product } = await db
    .from("marketplace_products")
    .select("name")
    .eq("id", productId)
    .single();

  // Get buyer profile for email
  const { data: buyer } = await db
    .from("profiles")
    .select("email, name")
    .eq("id", buyerId)
    .single();

  // Notify admin
  const { data: admins } = await db
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");

  if (admins) {
    for (const admin of admins) {
      await db.from("notifications").insert({
        user_id: admin.user_id,
        type: "system",
        title: "🛒 Nueva compra en Marketplace",
        message: `${buyer?.name || "Usuario"} compró ${product?.name || "un producto"} por $${totalAmount}`,
        data: { order_id: order?.id, url: "/admin/marketplace" },
      });
    }
  }

  // Send purchase confirmation email
  if (buyer?.email) {
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      await fetch(`${supabaseUrl}/functions/v1/send-purchase-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
        body: JSON.stringify({
          email: buyer.email,
          name: buyer.name || "Usuario",
          productName: product?.name || "Producto",
          amount: totalAmount,
          currency: "MXN",
          orderId: order?.id,
          shippingCity: order?.shipping_city,
          type: "purchase",
        }),
      });
      logStep("Marketplace purchase email sent", { buyerId });
    } catch (e) {
      logStep("Error sending marketplace email (non-critical)", { error: e instanceof Error ? e.message : e });
    }
  }

  // Notify admins of the new purchase (non-blocking)
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    await fetch(`${supabaseUrl}/functions/v1/notify-admin`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
      body: JSON.stringify({
        type: "new_purchase",
        data: {
          buyerEmail: buyer?.email || "—",
          buyerName: buyer?.name || "Usuario",
          productName: product?.name || "Producto",
          amount: totalAmount,
          currency: "MXN",
          orderId: order?.id,
        },
      }),
    });
    logStep("Admin notified of new purchase", { orderId: order?.id });
  } catch (e) {
    logStep("Error notifying admin of purchase (non-critical)", { error: e instanceof Error ? e.message : e });
  }

  logStep("Marketplace purchase completed", { buyerId, productId, orderId: order?.id });
}

// FEE de intermediación pagado (cliente 2026-07-01): el comprador pagó el fee → apartamos
// el producto para él y abrimos el chat con el proveedor. El vendedor cobra el producto por
// fuera; la plataforma solo cobró el fee (a la cuenta del super admin, sin Connect).
async function handleMarketplaceInterestFee(db: ReturnType<typeof supabaseAdmin>, session: Stripe.Checkout.Session) {
  const interestId = session.metadata!.interest_id;
  const buyerId = session.metadata!.buyer_id;
  const productId = session.metadata!.product_id;
  const vendorId = session.metadata!.vendor_id;
  const feeAmount = parseFloat(session.metadata!.fee_amount || "0");
  logStep("Processing marketplace interest fee", { interestId, buyerId, productId, feeAmount });

  // Idempotencia: si ya está pagado, no repetir.
  const { data: existing } = await db
    .from("product_interests")
    .select("id, status, chat_session_id")
    .eq("id", interestId)
    .single();
  if (!existing) { logStep("Interest not found", { interestId }); return; }
  if (existing.status === "paid" && existing.chat_session_id) {
    logStep("Interest already processed", { interestId }); return;
  }

  // Datos del vendedor (su user_id para el chat) y del producto.
  const { data: vendor } = await db
    .from("marketplace_vendors").select("user_id, name").eq("id", vendorId).single();
  const { data: product } = await db
    .from("marketplace_products").select("name").eq("id", productId).single();

  const paymentIntentId = typeof session.payment_intent === "string"
    ? session.payment_intent : (session.payment_intent as any)?.id ?? null;

  // Config para el tiempo de apartado.
  const { data: cfg } = await db.from("marketplace_config").select("reserve_hours").eq("id", true).single();
  const reserveHours = Number(cfg?.reserve_hours ?? 72);
  const now = new Date();
  const reservedUntil = new Date(now.getTime() + reserveHours * 3600 * 1000);

  // Abrir chat entre comprador y proveedor (ambos doctor/residente).
  let chatSessionId: string | null = existing.chat_session_id ?? null;
  if (!chatSessionId && vendor?.user_id) {
    const typeOf = async (uid: string): Promise<"doctor" | "resident"> => {
      const { data: rr } = await db.from("user_roles").select("role").eq("user_id", uid);
      const rs = (rr || []).map((r: { role: string }) => r.role);
      return rs.includes("resident") && !rs.includes("doctor") ? "resident" : "doctor";
    };
    const p1Type = await typeOf(buyerId);
    const p2Type = await typeOf(vendor.user_id);
    const { data: chat, error: chatErr } = await db
      .from("chat_sessions")
      .insert({
        participant1_id: buyerId,
        participant1_type: p1Type,
        participant2_id: vendor.user_id,
        participant2_type: p2Type,
        status: "active",
        last_message: `Interés en: ${product?.name || "producto"}`,
        last_message_at: now.toISOString(),
        marketplace_interest_id: interestId,
      })
      .select("id")
      .single();
    if (chatErr) logStep("Error creating marketplace chat (non-critical)", { error: chatErr.message });
    chatSessionId = chat?.id ?? null;
  }

  // Marcar interés pagado + enlazar chat.
  await db.from("product_interests").update({
    status: "paid",
    paid_at: now.toISOString(),
    stripe_payment_intent_id: paymentIntentId,
    chat_session_id: chatSessionId,
  }).eq("id", interestId);

  // Apartar el producto para el comprador.
  await db.from("marketplace_products").update({
    reserved_by: buyerId,
    reserved_at: now.toISOString(),
    reserved_until: reservedUntil.toISOString(),
    reserved_interest_id: interestId,
  }).eq("id", productId);

  // Notificar al proveedor y al comprador.
  const { data: buyer } = await db.from("profiles").select("name").eq("id", buyerId).single();
  if (vendor?.user_id) {
    await db.from("notifications").insert({
      user_id: vendor.user_id,
      type: "system",
      title: "🤝 Nuevo interesado en tu producto",
      message: `${buyer?.name || "Un colega"} apartó "${product?.name || "tu producto"}". Abre el chat para cerrar la venta.`,
      data: { url: "/chat", interest_id: interestId },
    });
  }
  await db.from("notifications").insert({
    user_id: buyerId,
    type: "system",
    title: "✅ Producto apartado",
    message: `Apartaste "${product?.name || "el producto"}". Ya puedes chatear con ${vendor?.name || "el proveedor"}.`,
    data: { url: "/chat", interest_id: interestId },
  });

  logStep("Marketplace interest fee completed", { interestId, chatSessionId, feeAmount });
}

// FEE de VENTA pagado por el VENDEDOR (modelo sin prepago, cliente 2026-07-01):
// la venta ya se concretó sin método de pago de por medio; aquí solo se liquida
// la comisión de la plataforma. Se notifica al vendedor y a los administradores.
async function handleMarketplaceSaleFee(db: ReturnType<typeof supabaseAdmin>, session: Stripe.Checkout.Session) {
  const interestId = session.metadata!.interest_id;
  const feeAmount = parseFloat(session.metadata!.fee_amount || "0");
  logStep("Processing marketplace sale fee", { interestId, feeAmount });

  const { data: order } = await db
    .from("product_interests")
    .select("id, fee_status, currency, marketplace_products!product_interests_product_id_fkey(name), marketplace_vendors(name, user_id)")
    .eq("id", interestId)
    .single();
  if (!order) { logStep("Sale fee: interest not found", { interestId }); return; }
  if (order.fee_status === "paid") { logStep("Sale fee already processed", { interestId }); return; }

  const paymentIntentId = typeof session.payment_intent === "string"
    ? session.payment_intent : (session.payment_intent as any)?.id ?? null;

  await db.from("product_interests").update({
    fee_status: "paid",
    fee_paid_at: new Date().toISOString(),
    stripe_payment_intent_id: paymentIntentId,
  }).eq("id", interestId);

  const productName = (order as any).marketplace_products?.name || "producto";
  const vendorName = (order as any).marketplace_vendors?.name || "Proveedor";
  const vendorUserId = (order as any).marketplace_vendors?.user_id as string | undefined;
  const feeTxt = `$${feeAmount.toLocaleString("es-MX")} ${order.currency || "MXN"}`;

  if (vendorUserId) {
    await db.from("notifications").insert({
      user_id: vendorUserId,
      type: "system",
      title: "✅ Fee de venta pagado",
      message: `Pagaste el fee (${feeTxt}) por la venta de "${productName}". ¡Gracias!`,
      data: { url: "/marketplace", interest_id: interestId },
    });
  }
  const { data: adminRows } = await db.from("user_roles").select("user_id").eq("role", "admin");
  const adminNotifs = (adminRows || []).map((r: { user_id: string }) => ({
    user_id: r.user_id,
    type: "system",
    title: "💵 Marketplace: fee cobrado",
    message: `${vendorName} pagó el fee (${feeTxt}) por la venta de "${productName}".`,
    data: { url: "/admin/marketplace-fee", interest_id: interestId },
  }));
  if (adminNotifs.length > 0) await db.from("notifications").insert(adminNotifs);

  logStep("Marketplace sale fee completed", { interestId, feeAmount });
}

// Restore stock + mark order abandoned when a marketplace checkout expires.
// Stock was decremented up-front in create-marketplace-checkout; if the user
// never paid, we must release that hold or inventory leaks forever.
async function handleMarketplaceCheckoutExpired(db: ReturnType<typeof supabaseAdmin>, session: Stripe.Checkout.Session) {
  const productId = session.metadata?.product_id;
  const quantityStr = session.metadata?.quantity;
  if (!productId || !quantityStr) {
    logStep("Marketplace expired: missing product/quantity metadata", { sessionId: session.id });
    return;
  }
  const quantity = parseInt(quantityStr, 10);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    logStep("Marketplace expired: invalid quantity", { quantityStr });
    return;
  }

  // Only restore if the order is still pending (not paid by a late webhook race)
  const { data: order } = await db
    .from("marketplace_orders")
    .select("id, status")
    .eq("stripe_session_id", session.id)
    .maybeSingle();

  if (!order) {
    logStep("Marketplace expired: no order found", { sessionId: session.id });
    return;
  }
  if (order.status !== "pending") {
    logStep("Marketplace expired: order not pending, skipping restore", { sessionId: session.id, status: order.status });
    return;
  }

  // Restore stock atomically. Use RPC if available, fallback to SQL.
  const { error: restoreErr } = await db.rpc("restore_marketplace_stock", {
    p_product_id: productId,
    p_quantity: quantity,
  });
  if (restoreErr) {
    // Fallback: read-modify-write (acceptable because expiry is rare)
    const { data: prod } = await db
      .from("marketplace_products")
      .select("stock")
      .eq("id", productId)
      .single();
    if (prod) {
      await db.from("marketplace_products").update({ stock: prod.stock + quantity }).eq("id", productId);
    }
  }

  await db
    .from("marketplace_orders")
    .update({ status: "abandoned" })
    .eq("id", order.id);

  logStep("Marketplace expired: stock restored", { productId, quantity, orderId: order.id });
}

// Mark an abandoned ad_payment when its checkout session expires so we don't
// keep stale "pending" rows forever and so we can clean them up later.
// Ad checkout completado: confirma el pago (ad_payments -> paid, lo que el
// trigger contable convierte en ingreso) y manda la campaña a revisión admin.
async function handleAdPurchaseCompleted(db: ReturnType<typeof supabaseAdmin>, session: Stripe.Checkout.Session) {
  const campaignId = session.metadata?.campaign_id;
  const { error: payErr } = await db
    .from("ad_payments")
    .update({ status: "paid" })
    .eq("stripe_session_id", session.id)
    .eq("status", "pending");
  if (payErr) {
    logStep("Error marking ad_payment as paid", { error: payErr.message, sessionId: session.id });
    return;
  }
  if (campaignId) {
    await db.from("ad_campaigns").update({ status: "pending_review" }).eq("id", campaignId);
  }
  logStep("ad_payment marked paid", { sessionId: session.id, campaignId });
}

async function handleAdCheckoutExpired(db: ReturnType<typeof supabaseAdmin>, session: Stripe.Checkout.Session) {
  const { error } = await db
    .from("ad_payments")
    .update({ status: "abandoned" })
    .eq("stripe_session_id", session.id)
    .eq("status", "pending");
  if (error) {
    logStep("Error marking ad_payment as abandoned", { error: error.message, sessionId: session.id });
  } else {
    logStep("ad_payment marked abandoned", { sessionId: session.id });
  }
}
