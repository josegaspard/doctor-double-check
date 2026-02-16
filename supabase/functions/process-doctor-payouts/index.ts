import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PayoutSettings {
  commission_percentage: number;
  minimum_payout_amount: number;
  auto_payout_enabled: boolean;
  require_invoice: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ========== AUTHENTICATION CHECK ==========
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAdmin.auth.getUser(token);
    
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", claimsData.user.id)
      .single();

    if (roleData?.role !== "admin") {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized - admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // ========== END AUTHENTICATION CHECK ==========

    // Parse request body for optional single-doctor mode
    let requestBody: { doctor_id?: string; single?: boolean } = {};
    try {
      const bodyText = await req.text();
      if (bodyText) requestBody = JSON.parse(bodyText);
    } catch { /* no body = bulk mode */ }

    const singleDoctorId = requestBody.single ? requestBody.doctor_id : null;

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Get payout settings
    const { data: settings } = await supabaseAdmin
      .from("payout_settings")
      .select("*")
      .eq("id", "default")
      .single();

    const payoutSettings: PayoutSettings = settings || {
      commission_percentage: 20,
      minimum_payout_amount: 100,
      auto_payout_enabled: true,
      require_invoice: true,
    };

    // For bulk mode, check if auto-payout is enabled
    if (!singleDoctorId && !payoutSettings.auto_payout_enabled) {
      return new Response(
        JSON.stringify({ success: true, message: "Auto-payout is disabled", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build query for doctors
    let query = supabaseAdmin
      .from("doctor_profiles")
      .select("user_id, pending_earnings, stripe_account_id, payouts_enabled")
      .not("stripe_account_id", "is", null);

    if (singleDoctorId) {
      // Single doctor mode - process regardless of minimum
      query = query.eq("user_id", singleDoctorId).gt("pending_earnings", 0);
    } else {
      // Bulk mode - apply minimum and payout enabled filter
      query = query
        .gte("pending_earnings", payoutSettings.minimum_payout_amount)
        .eq("payouts_enabled", true);
    }

    const { data: doctors } = await query;

    if (!doctors || doctors.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No doctors eligible for payout", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let processedCount = 0;
    const errors: string[] = [];

    for (const doctor of doctors) {
      try {
        // Check invoice requirement (skip for single-doctor admin-initiated payouts)
        if (!singleDoctorId && payoutSettings.require_invoice) {
          const { data: invoice } = await supabaseAdmin
            .from("doctor_invoices")
            .select("id")
            .eq("doctor_id", doctor.user_id)
            .eq("status", "approved")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!invoice) {
            console.log(`Doctor ${doctor.user_id} has no approved invoice, skipping`);
            continue;
          }
        }

        // Calculate payout amount (after commission)
        const commissionRate = payoutSettings.commission_percentage / 100;
        const payoutAmount = doctor.pending_earnings * (1 - commissionRate);
        const payoutAmountCents = Math.round(payoutAmount * 100);

        // Create transfer to connected account
        const transfer = await stripe.transfers.create({
          amount: payoutAmountCents,
          currency: "mxn",
          destination: doctor.stripe_account_id!,
          metadata: {
            doctor_id: doctor.user_id,
            gross_amount: doctor.pending_earnings.toString(),
            commission_percentage: payoutSettings.commission_percentage.toString(),
          },
        });

        // Create payout record
        await supabaseAdmin.from("doctor_payouts").insert({
          doctor_id: doctor.user_id,
          amount: payoutAmount,
          stripe_transfer_id: transfer.id,
          status: "processing",
          period_end: new Date().toISOString().split("T")[0],
        });

        // Update doctor pending earnings
        const { data: currentProfile } = await supabaseAdmin
          .from("doctor_profiles")
          .select("total_earnings")
          .eq("user_id", doctor.user_id)
          .single();

        const currentTotal = currentProfile?.total_earnings || 0;

        // Notify doctor about payout
        await supabaseAdmin.from("notifications").insert({
          user_id: doctor.user_id,
          type: "system",
          title: "💰 Pago procesado",
          message: `Se ha iniciado una transferencia de $${payoutAmount.toFixed(2)} MXN a tu cuenta bancaria`,
          data: {
            amount: payoutAmount,
            gross_amount: doctor.pending_earnings,
            commission: doctor.pending_earnings - payoutAmount,
            transfer_id: transfer.id,
          },
        });
        
        await supabaseAdmin
          .from("doctor_profiles")
          .update({
            pending_earnings: 0,
            total_earnings: currentTotal + doctor.pending_earnings,
          })
          .eq("user_id", doctor.user_id);

        processedCount++;
        console.log(`Processed payout for doctor ${doctor.user_id}: ${payoutAmount} MXN`);
      } catch (error: any) {
        console.error(`Error processing payout for doctor ${doctor.user_id}:`, error);
        errors.push(`${doctor.user_id}: ${error.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${processedCount} payouts`,
        processed: processedCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in process-doctor-payouts:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Error al procesar payouts" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
