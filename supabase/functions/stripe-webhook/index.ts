import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const signature = req.headers.get("stripe-signature");
    const body = await req.text();

    let event: Stripe.Event;

    if (webhookSecret && signature) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
        logStep("Webhook signature verified");
      } catch (err) {
        logStep("Webhook signature verification failed", { error: err });
        return new Response(JSON.stringify({ error: "Webhook signature verification failed" }), { status: 400 });
      }
    } else {
      event = JSON.parse(body);
      logStep("Webhook parsed without signature verification (dev mode)");
    }

    logStep("Event type", { type: event.type });

    const db = supabaseAdmin();

    // Handle checkout.session.completed
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      logStep("Checkout session completed", { sessionId: session.id, metadata: session.metadata });

      // Wallet topup
      if (session.metadata?.type === "wallet_topup" && session.payment_status === "paid") {
        await handleWalletTopup(db, session);
      }

      // Recording purchase - credit doctor earnings
      if (session.metadata?.type === "recording_purchase" && session.payment_status === "paid") {
        await handleRecordingPurchase(db, session);
      }

      // Creator subscription - credit doctor earnings
      if (session.metadata?.type === "creator_subscription" && session.payment_status === "paid") {
        await handleCreatorSubscription(db, session);
      }

      // Consultation payment - create entitlement and credit doctor
      if (session.metadata?.type === "consultation_payment" && session.payment_status === "paid") {
        await handleConsultationPayment(db, session);
      }
    }

    // *** CRITICAL FIX: Handle subscription renewals ***
    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as Stripe.Invoice;
      await handleInvoicePaymentSucceeded(db, invoice);
    }

    // *** CRITICAL FIX: Handle subscription cancellations ***
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionDeleted(db, subscription);
    }

    // Handle Stripe Connect account updates
    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account;
      await handleAccountUpdated(db, account);
    }

    // Handle transfer events for payouts
    if (event.type === "transfer.paid") {
      const transfer = event.data.object as Stripe.Transfer;
      await handleTransferPaid(db, transfer);
    }

    if (event.type === "transfer.failed") {
      const transfer = event.data.object as Stripe.Transfer;
      await handleTransferFailed(db, transfer);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
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

  const { data: currentWallet } = await db
    .from("wallets")
    .select("balance")
    .eq("user_id", userId)
    .single();

  if (currentWallet) {
    const newBalance = Number(currentWallet.balance) + amount;
    await db
      .from("wallets")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    
    logStep("Wallet updated successfully", { userId, newBalance });
  }
}

async function handleRecordingPurchase(db: ReturnType<typeof supabaseAdmin>, session: Stripe.Checkout.Session) {
  const userId = session.metadata!.user_id;
  const recordingId = session.metadata!.recording_id;
  const amount = parseFloat(session.metadata!.amount);
  
  logStep("Processing recording purchase", { userId, recordingId, amount });

  // Create purchase record
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

  // Get recording to find doctor
  const { data: recording } = await db
    .from("recordings")
    .select("doctor_id")
    .eq("id", recordingId)
    .single();

  if (recording?.doctor_id) {
    await creditDoctorEarnings(db, recording.doctor_id, amount, "recording", recordingId);
  }
}

async function handleCreatorSubscription(db: ReturnType<typeof supabaseAdmin>, session: Stripe.Checkout.Session) {
  const userId = session.metadata!.user_id;
  const creatorId = session.metadata!.creator_id;
  const tier = session.metadata!.tier as "basic" | "premium";
  
  logStep("Processing creator subscription", { userId, creatorId, tier });

  const tierPrice = tier === "premium" ? 199 : 99;
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

  // Notify creator
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

  // Credit earnings to doctor
  await creditDoctorEarnings(db, creatorId, tierPrice, "subscription", null);
}

async function handleConsultationPayment(db: ReturnType<typeof supabaseAdmin>, session: Stripe.Checkout.Session) {
  const userId = session.metadata!.user_id;
  const doctorId = session.metadata!.doctor_id;
  const finalFee = parseFloat(session.metadata!.final_fee);
  
  logStep("Processing consultation payment", { userId, doctorId, finalFee });

  // Create chat entitlement for the patient (valid for 30 days)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const { error: entitlementError } = await db
    .from("entitlements")
    .insert({
      user_id: userId,
      type: "chat",
      is_active: true,
      expires_at: expiresAt.toISOString(),
    });

  if (entitlementError) {
    logStep("Error creating entitlement", { error: entitlementError });
  } else {
    logStep("Chat entitlement created", { userId, expiresAt });
  }

  // Get patient user role
  const { data: patientRole } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();

  // Check if a chat session already exists
  const { data: existingSession } = await db
    .from("chat_sessions")
    .select("id")
    .or(`and(participant1_id.eq.${userId},participant2_id.eq.${doctorId}),and(participant1_id.eq.${doctorId},participant2_id.eq.${userId})`)
    .eq("status", "active")
    .eq("is_double_check", false)
    .maybeSingle();

  let chatSessionId = existingSession?.id;

  // Create chat session if it doesn't exist
  if (!chatSessionId) {
    const { data: newSession, error: sessionError } = await db
      .from("chat_sessions")
      .insert({
        participant1_id: userId,
        participant1_type: patientRole?.role || "patient",
        participant2_id: doctorId,
        participant2_type: "doctor",
        status: "active",
        is_double_check: false,
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

  // Create consultation record for ratings and history
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

  // Credit doctor earnings
  await creditDoctorEarnings(db, doctorId, finalFee, "consultation", null);

  // Create a wallet transaction record for the patient
  await db
    .from("wallet_transactions")
    .insert({
      user_id: userId,
      type: "purchase",
      amount: -finalFee,
      description: "Consulta médica por chat",
      status: "paid",
      metadata: { doctor_id: doctorId, stripe_session_id: session.id, consultation_id: consultation?.id },
    });

  // Get patient name for notification
  const { data: patientProfile } = await db
    .from("profiles")
    .select("name")
    .eq("id", userId)
    .single();

  // Notify the patient that the payment was successful
  await db
    .from("notifications")
    .insert({
      user_id: userId,
      type: "system",
      title: "Pago exitoso",
      message: "Tu consulta ha sido pagada. Ya puedes iniciar el chat con tu médico.",
      data: { doctor_id: doctorId, session_id: chatSessionId },
    });

  // Notify the doctor about the new consultation
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

async function creditDoctorEarnings(
  db: ReturnType<typeof supabaseAdmin>,
  doctorId: string,
  amount: number,
  source: string,
  referenceId: string | null
) {
  logStep("Crediting doctor earnings", { doctorId, amount, source });

  // Get current pending earnings
  const { data: profile } = await db
    .from("doctor_profiles")
    .select("pending_earnings, total_earnings")
    .eq("user_id", doctorId)
    .single();

  if (!profile) {
    logStep("Doctor profile not found", { doctorId });
    return;
  }

  const currentPending = profile.pending_earnings || 0;
  const newPending = currentPending + amount;

  // Update pending earnings
  const { error: updateError } = await db
    .from("doctor_profiles")
    .update({ pending_earnings: newPending })
    .eq("user_id", doctorId);

  if (updateError) {
    logStep("Error updating earnings", { error: updateError });
    return;
  }

  logStep("Doctor earnings credited", { doctorId, amount, newPending, source });

  // Create earning transaction record
  await db
    .from("wallet_transactions")
    .insert({
      user_id: doctorId,
      type: "earning",
      amount: amount,
      description: `Ganancia por ${source === "recording" ? "venta de grabación" : source === "consultation" ? "consulta médica" : "suscripción"}`,
      status: "paid",
      metadata: { source, reference_id: referenceId },
    });
}

async function handleAccountUpdated(db: ReturnType<typeof supabaseAdmin>, account: Stripe.Account) {
  logStep("Account updated", { accountId: account.id, payoutsEnabled: account.payouts_enabled });

  // Find doctor by stripe account id
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

  // Update bank account status
  await db
    .from("doctor_bank_accounts")
    .update({
      stripe_account_status: status,
      payouts_enabled: account.payouts_enabled || false,
      onboarding_completed: account.details_submitted || false,
      is_verified: account.payouts_enabled || false,
    })
    .eq("stripe_account_id", account.id);

  // Update doctor profile
  await db
    .from("doctor_profiles")
    .update({
      payouts_enabled: account.payouts_enabled || false,
    })
    .eq("user_id", bankAccount.doctor_id);

  logStep("Account status updated", { doctorId: bankAccount.doctor_id, status });
}

async function handleTransferPaid(db: ReturnType<typeof supabaseAdmin>, transfer: Stripe.Transfer) {
  logStep("Transfer paid", { transferId: transfer.id, destination: transfer.destination });

  const { error } = await db
    .from("doctor_payouts")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
    })
    .eq("stripe_transfer_id", transfer.id);

  if (error) {
    logStep("Error updating payout status", { error });
  } else {
    logStep("Payout marked as paid", { transferId: transfer.id });
  }
}

async function handleTransferFailed(db: ReturnType<typeof supabaseAdmin>, transfer: Stripe.Transfer) {
  logStep("Transfer failed", { transferId: transfer.id });

  const { error } = await db
    .from("doctor_payouts")
    .update({
      status: "failed",
      error_message: "Transfer failed",
    })
    .eq("stripe_transfer_id", transfer.id);

  if (error) {
    logStep("Error updating payout status", { error });
  } else {
    logStep("Payout marked as failed", { transferId: transfer.id });
  }
}

// *** NEW HANDLER: Handle subscription renewals ***
async function handleInvoicePaymentSucceeded(db: ReturnType<typeof supabaseAdmin>, invoice: Stripe.Invoice) {
  // Only handle subscription invoices (not first payment which is handled by checkout.session.completed)
  if (!invoice.subscription || invoice.billing_reason === 'subscription_create') {
    logStep("Skipping invoice - not a renewal", { reason: invoice.billing_reason });
    return;
  }

  logStep("Processing subscription renewal", { 
    subscriptionId: invoice.subscription, 
    customerId: invoice.customer 
  });

  const customerEmail = invoice.customer_email;
  if (!customerEmail) {
    logStep("No customer email in invoice");
    return;
  }

  // Find user by email
  const { data: profile } = await db
    .from("profiles")
    .select("id")
    .eq("email", customerEmail)
    .single();

  if (!profile) {
    logStep("User not found for email", { email: customerEmail });
    return;
  }

  const userId = profile.id;

  // Find and extend the subscription
  const { data: subscriptions, error: subError } = await db
    .from("subscriptions")
    .select("*")
    .eq("subscriber_id", userId)
    .eq("is_active", true);

  if (subError || !subscriptions || subscriptions.length === 0) {
    logStep("No active subscription found for user", { userId });
    return;
  }

  // Extend expiration by one month
  for (const sub of subscriptions) {
    const newExpiresAt = new Date();
    newExpiresAt.setMonth(newExpiresAt.getMonth() + 1);

    await db
      .from("subscriptions")
      .update({
        expires_at: newExpiresAt.toISOString(),
        is_active: true,
      })
      .eq("id", sub.id);

    logStep("Subscription renewed", { subscriptionId: sub.id, newExpiresAt });

    // Credit creator earnings
    await creditDoctorEarnings(db, sub.creator_id, sub.price_paid, "subscription_renewal", null);

    // Notify creator about renewal
    await db
      .from("notifications")
      .insert({
        user_id: sub.creator_id,
        type: "subscription_update",
        title: "🔄 Suscripción renovada",
        message: `Un suscriptor ha renovado su suscripción ${sub.tier}`,
        data: { subscriber_id: userId, tier: sub.tier },
      });
  }
}

// *** NEW HANDLER: Handle subscription cancellations ***
async function handleSubscriptionDeleted(db: ReturnType<typeof supabaseAdmin>, subscription: Stripe.Subscription) {
  logStep("Processing subscription cancellation", { subscriptionId: subscription.id });

  const customerEmail = (subscription.customer as any)?.email;
  if (!customerEmail) {
    logStep("No customer email in subscription");
    return;
  }

  // Find user by email
  const { data: profile } = await db
    .from("profiles")
    .select("id")
    .eq("email", customerEmail)
    .maybeSingle();

  if (!profile) {
    logStep("User not found for cancelled subscription");
    return;
  }

  // Deactivate all subscriptions for this user
  const { data: subs } = await db
    .from("subscriptions")
    .update({ is_active: false })
    .eq("subscriber_id", profile.id)
    .eq("is_active", true)
    .select();

  if (subs && subs.length > 0) {
    for (const sub of subs) {
      // Notify creator about cancellation
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
    
    logStep("Subscriptions deactivated", { count: subs.length });
  }
}
