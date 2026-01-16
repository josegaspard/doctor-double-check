import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PURCHASE-RECORDING-WALLET] ${step}${detailsStr}`);
};

serve(async (req) => {
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
