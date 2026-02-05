import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);

    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const { recordingId } = await req.json();
    if (!recordingId) throw new Error("recordingId is required");
    logStep("Recording ID received", { recordingId });

    // Get recording details
    const { data: recording, error: recordingError } = await supabaseClient
      .from('recordings')
      .select('*')
      .eq('id', recordingId)
      .single();

    if (recordingError || !recording) {
      throw new Error("Recording not found");
    }
    logStep("Recording found", { title: recording.title, price: recording.price });

    // Check if already purchased
    const { data: existingPurchase } = await supabaseClient
      .from('purchases')
      .select('id')
      .eq('user_id', user.id)
      .eq('recording_id', recordingId)
      .single();

    if (existingPurchase) {
      return new Response(
        JSON.stringify({ success: true, alreadyPurchased: true }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Use the process_wallet_purchase RPC function
    const { data: purchaseResult, error: purchaseError } = await supabaseClient
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

    // Create purchase record
    const { error: insertError } = await supabaseClient
      .from('purchases')
      .insert({
        user_id: user.id,
        recording_id: recordingId,
        amount: purchaseResult.amount_charged,
      });

    if (insertError) {
      logStep("Error creating purchase record", { error: insertError.message });
      // Don't throw - wallet transaction already succeeded
    }

    // Create entitlement
    await supabaseClient
      .from('entitlements')
      .insert({
        user_id: user.id,
        type: `recording_${recordingId}`,
        is_active: true,
      });

    // *** CRITICAL FIX: Credit doctor earnings ***
    const doctorId = recording.doctor_id;
    const amountToCredit = purchaseResult.amount_charged;
    
    // Get current pending earnings
    const { data: doctorProfile } = await supabaseClient
      .from('doctor_profiles')
      .select('pending_earnings')
      .eq('user_id', doctorId)
      .single();

    if (doctorProfile) {
      const currentPending = doctorProfile.pending_earnings || 0;
      const newPending = currentPending + amountToCredit;

      // Update doctor pending earnings
      await supabaseClient
        .from('doctor_profiles')
        .update({ pending_earnings: newPending })
        .eq('user_id', doctorId);

      logStep("Doctor earnings credited", { doctorId, amountToCredit, newPending });

      // Create earning transaction record for doctor
      await supabaseClient
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

    // Send purchase confirmation email
    try {
      await supabaseClient.functions.invoke('send-purchase-email', {
        body: {
          userId: user.id,
          purchaseType: 'recording',
          itemTitle: recording.title,
          amount: purchaseResult.amount_charged,
        },
      });
      logStep("Purchase confirmation email sent");
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
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
