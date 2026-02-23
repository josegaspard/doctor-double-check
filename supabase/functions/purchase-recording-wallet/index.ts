import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PURCHASE-RECORDING-WALLET] ${step}${detailsStr}`);
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

    const { recordingId } = await req.json();
    if (!recordingId) throw new Error("recordingId is required");
    logStep("Recording ID received", { recordingId });

    // Get recording details
    const { data: recording, error: recordingError } = await adminClient
      .from('recordings')
      .select('id, title, price, doctor_id, specialty')
      .eq('id', recordingId)
      .single();

    if (recordingError || !recording) {
      throw new Error("Recording not found");
    }
    logStep("Recording found", { title: recording.title, price: recording.price });

    // Check if already purchased
    const { data: existingPurchase } = await adminClient
      .from('purchases')
      .select('id')
      .eq('user_id', user.id)
      .eq('recording_id', recordingId)
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
        p_amount: recording.price,
        p_description: `Grabación: ${recording.title}`,
        p_metadata: { recording_id: recordingId },
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
        recording_id: recordingId,
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
        type: `recording_${recordingId}`,
        is_active: true,
      });

    // Credit doctor earnings atomically
    const doctorId = recording.doctor_id;
    const amountToCredit = purchaseResult.amount_charged;
    
    const { data: newPending, error: rpcError } = await adminClient.rpc("credit_doctor_earnings", {
      p_doctor_id: doctorId,
      p_amount: amountToCredit,
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
          description: `Ganancia por venta de grabación: ${recording.title}`,
          status: 'paid',
          metadata: { source: 'recording', recording_id: recordingId, buyer_id: user.id },
        });
    }

    // Send purchase confirmation email (non-critical)
    try {
      await adminClient.functions.invoke('send-purchase-email', {
        body: {
          userId: user.id,
          purchaseType: 'recording',
          itemTitle: recording.title,
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
