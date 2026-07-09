import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PURCHASE-CONTENT-WALLET] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Admin client for queries that bypass RLS
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await adminClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);

    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const { contentId } = await req.json();
    if (!contentId) throw new Error("contentId is required");
    logStep("Content ID received", { contentId });

    // Get content details
    const { data: content, error: contentError } = await adminClient
      .from('doctor_content')
      .select('id, title, price, creator_id, moderation_status')
      .eq('id', contentId)
      .single();

    if (contentError || !content) {
      throw new Error("Content not found");
    }
    if (!content.price || content.price <= 0) {
      throw new Error("This content is free");
    }
    if (content.creator_id === user.id) {
      throw new Error("You cannot purchase your own content");
    }
    if (content.moderation_status !== 'approved') {
      throw new Error("Content not available");
    }
    logStep("Content found", { title: content.title, price: content.price });

    // Check if already purchased
    const { data: existingPurchase } = await adminClient
      .from('purchases')
      .select('id')
      .eq('user_id', user.id)
      .eq('content_id', contentId)
      .maybeSingle();

    if (existingPurchase) {
      return new Response(
        JSON.stringify({ success: true, alreadyPurchased: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Use a user-scoped client for the RPC call (so auth.uid() works)
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Use the process_wallet_purchase RPC function (requires auth.uid())
    const { data: purchaseResult, error: purchaseError } = await userClient
      .rpc('process_wallet_purchase', {
        p_amount: content.price,
        p_description: `Libro/Curso: ${content.title}`,
        p_metadata: { content_id: contentId },
        // Natural idempotency key: closes the concurrent-double-click race
        // (the "already purchased" pre-check above only covers the sequential case).
        p_idempotency_key: `content:${contentId}`,
      });

    if (purchaseError) {
      logStep("Purchase RPC error", { error: purchaseError.message });
      throw new Error(purchaseError.message);
    }

    if (!purchaseResult?.success) {
      throw new Error(purchaseResult?.error || "Purchase failed");
    }

    logStep("Wallet purchase successful", {
      amountCharged: purchaseResult.amount_charged,
      newBalance: purchaseResult.new_balance
    });

    // Create purchase record (admin client to bypass RLS)
    const { error: insertError } = await adminClient
      .from('purchases')
      .insert({
        user_id: user.id,
        content_id: contentId,
        amount: purchaseResult.amount_charged,
      });

    if (insertError) {
      logStep("Error creating purchase record", { error: insertError.message });
    }

    // Create entitlement
    await adminClient
      .from('entitlements')
      .insert({
        user_id: user.id,
        type: `content_${contentId}`,
        is_active: true,
      });

    // Credit doctor earnings atomically (fn_commission_rate ya reconoce 'content')
    const doctorId = content.creator_id;
    const amountToCredit = purchaseResult.amount_charged;

    const { data: newPending, error: rpcError } = await adminClient.rpc("credit_doctor_earnings", {
      p_doctor_id: doctorId,
      p_amount: amountToCredit,
      p_sale_type: 'content',
    });

    if (rpcError || newPending === -1) {
      logStep("Error crediting earnings atomically", { error: rpcError, doctorId });
    } else {
      logStep("Doctor earnings credited atomically", { doctorId, amountToCredit, newPending });

      await adminClient
        .from('wallet_transactions')
        .insert({
          user_id: doctorId,
          type: 'earning',
          amount: amountToCredit,
          description: `Ganancia por venta de libro/curso: ${content.title}`,
          status: 'paid',
          metadata: { source: 'content', content_id: contentId, buyer_id: user.id },
        });
    }

    // Notificar al doctor: "te compraron un libro"
    try {
      const { data: buyerProfile } = await adminClient
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .maybeSingle();
      const buyerName = buyerProfile?.name || "Un usuario";
      await adminClient.from('notifications').insert({
        user_id: doctorId,
        type: 'content_purchase',
        title: 'Nueva venta de libro/curso',
        message: `${buyerName} compró "${content.title}" por $${Number(purchaseResult.amount_charged).toFixed(2)} MXN`,
        data: { content_id: contentId, buyer_id: user.id, amount: purchaseResult.amount_charged },
      });
    } catch (notifyError) {
      logStep("Failed to notify doctor (non-critical)", { error: notifyError });
    }

    // Send purchase confirmation email (non-critical)
    try {
      await adminClient.functions.invoke('send-purchase-email', {
        body: {
          userId: user.id,
          purchaseType: 'content',
          itemTitle: content.title,
          amount: purchaseResult.amount_charged,
        },
      });
    } catch (emailError) {
      logStep("Email sending failed (non-critical)", { error: emailError });
    }

    logStep("Purchase completed successfully");

    return new Response(
      JSON.stringify({
        success: true,
        amountCharged: purchaseResult.amount_charged,
        newBalance: purchaseResult.new_balance,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
