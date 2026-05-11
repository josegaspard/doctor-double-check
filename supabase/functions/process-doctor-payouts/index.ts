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

    let requestBody: { doctor_id?: string; single?: boolean } = {};
    try {
      const bodyText = await req.text();
      if (bodyText) requestBody = JSON.parse(bodyText);
    } catch { /* no body = bulk mode */ }

    const singleDoctorId = requestBody.single ? requestBody.doctor_id : null;

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-03-31.basil",
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

    if (!singleDoctorId && !payoutSettings.auto_payout_enabled) {
      return new Response(
        JSON.stringify({ success: true, message: "Auto-payout is disabled", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let query = supabaseAdmin
      .from("doctor_profiles")
      .select("user_id, pending_earnings, stripe_account_id, payouts_enabled")
      .not("stripe_account_id", "is", null);

    if (singleDoctorId) {
      query = query.eq("user_id", singleDoctorId).gt("pending_earnings", 0);
    } else {
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
        // FIX #3: Double-payment protection - check for existing processing payout
        const { data: existingPayout } = await supabaseAdmin
          .from("doctor_payouts")
          .select("id")
          .eq("doctor_id", doctor.user_id)
          .eq("status", "processing")
          .maybeSingle();

        if (existingPayout) {
          console.log(`Doctor ${doctor.user_id} already has a processing payout, skipping`);
          errors.push(`${doctor.user_id}: Already has a processing payout`);
          continue;
        }

        // Check invoice requirement (skip for single-doctor admin-initiated payouts)
        let invoiceId: string | null = null;
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
          // FIX #5: Link payout to invoice
          invoiceId = invoice.id;
        } else if (singleDoctorId) {
          // For single payouts, try to link the latest approved invoice if available
          const { data: invoice } = await supabaseAdmin
            .from("doctor_invoices")
            .select("id")
            .eq("doctor_id", doctor.user_id)
            .eq("status", "approved")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          invoiceId = invoice?.id || null;
        }

        // Fresh-fetch the Stripe Connect account before issuing a transfer.
        // payouts_enabled in our DB can drift if account.updated webhooks
        // missed delivery; transferring to a restricted/unverified account
        // either fails outright or leaves money frozen at Stripe.
        try {
          const accountFresh = await stripe.accounts.retrieve(doctor.stripe_account_id!);
          if (!accountFresh.details_submitted || !accountFresh.payouts_enabled || accountFresh.requirements?.disabled_reason) {
            console.warn(`Doctor ${doctor.user_id} Connect account not payout-ready`, {
              details_submitted: accountFresh.details_submitted,
              payouts_enabled: accountFresh.payouts_enabled,
              disabled_reason: accountFresh.requirements?.disabled_reason,
            });
            // Sync our local copy so future runs reflect Stripe truth
            await supabaseAdmin
              .from("doctor_profiles")
              .update({ stripe_payouts_enabled: !!accountFresh.payouts_enabled, stripe_charges_enabled: !!accountFresh.charges_enabled })
              .eq("user_id", doctor.user_id);
            errors.push(`${doctor.user_id}: Stripe Connect account not payout-ready (${accountFresh.requirements?.disabled_reason || 'pending requirements'})`);
            continue;
          }
        } catch (accErr: any) {
          console.error(`Failed to fetch Stripe account for ${doctor.user_id}:`, accErr?.message);
          errors.push(`${doctor.user_id}: could not verify Stripe account`);
          continue;
        }

        // Calculate payout amount (after commission)
        const commissionRate = payoutSettings.commission_percentage / 100;
        const grossAmount = doctor.pending_earnings;
        const payoutAmount = grossAmount * (1 - commissionRate);
        const payoutAmountCents = Math.round(payoutAmount * 100);

        // Create transfer to connected account
        const transfer = await stripe.transfers.create({
          amount: payoutAmountCents,
          currency: "mxn",
          destination: doctor.stripe_account_id!,
          metadata: {
            doctor_id: doctor.user_id,
            gross_amount: grossAmount.toString(),
            commission_percentage: payoutSettings.commission_percentage.toString(),
          },
        });

        // FIX #5 + #8: Create payout record with invoice_id and period_start
        const now = new Date().toISOString().split("T")[0];
        await supabaseAdmin.from("doctor_payouts").insert({
          doctor_id: doctor.user_id,
          amount: payoutAmount,
          stripe_transfer_id: transfer.id,
          status: "processing",
          period_start: now,
          period_end: now,
          invoice_id: invoiceId,
        });

        // FIX #1: Use atomic DB function instead of read-then-write
        const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc("process_doctor_payout", {
          p_doctor_id: doctor.user_id,
          p_payout_amount: payoutAmount,
          p_gross_amount: grossAmount,
        });

        if (rpcError) {
          console.error(`Error in atomic payout for ${doctor.user_id}:`, rpcError);
          errors.push(`${doctor.user_id}: ${rpcError.message}`);
          continue;
        }

        const result = rpcResult as { success: boolean; error?: string };
        if (!result.success) {
          console.error(`Atomic payout failed for ${doctor.user_id}:`, result.error);
          errors.push(`${doctor.user_id}: ${result.error}`);
          continue;
        }

        // Notify doctor about payout (in-app)
        await supabaseAdmin.from("notifications").insert({
          user_id: doctor.user_id,
          type: "system",
          title: "💰 Pago procesado",
          message: `Se ha iniciado una transferencia de $${payoutAmount.toFixed(2)} MXN a tu cuenta bancaria`,
          data: {
            amount: payoutAmount,
            gross_amount: grossAmount,
            commission: grossAmount - payoutAmount,
            transfer_id: transfer.id,
          },
        });

        // FIX #15: Send email notification to doctor about payout
        try {
          const { data: doctorProfile } = await supabaseAdmin
            .from("profiles")
            .select("email, name")
            .eq("id", doctor.user_id)
            .single();

          if (doctorProfile?.email) {
            const resendKey = Deno.env.get("RESEND_API_KEY");
            if (resendKey) {
              await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${resendKey}`,
                },
                body: JSON.stringify({
                  from: "Medical Masters <no-reply@cirugiaesteticauribe.com>",
                  to: [doctorProfile.email],
                  subject: "💰 Pago procesado - Medical Masters",
                  html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                      <h2>¡Hola ${doctorProfile.name || "Doctor"}!</h2>
                      <p>Se ha procesado un pago a tu cuenta bancaria:</p>
                      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;">Monto bruto:</td><td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${grossAmount.toFixed(2)} MXN</td></tr>
                        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;">Comisión plataforma:</td><td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; color: #e53e3e;">-$${(grossAmount - payoutAmount).toFixed(2)} MXN</td></tr>
                        <tr><td style="padding: 8px; font-weight: bold;">Monto neto:</td><td style="padding: 8px; text-align: right; font-weight: bold; color: #38a169;">$${payoutAmount.toFixed(2)} MXN</td></tr>
                      </table>
                      <p>El depósito llegará a tu cuenta en 2-3 días hábiles.</p>
                      <p style="color: #718096; font-size: 12px;">Este es un correo automático de Medical Masters.</p>
                    </div>
                  `,
                }),
              });
              console.log(`Payout email sent to ${doctorProfile.email}`);
            }
          }
        } catch (emailError) {
          console.error(`Error sending payout email for ${doctor.user_id}:`, emailError);
          // Don't fail the payout if email fails
        }

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
