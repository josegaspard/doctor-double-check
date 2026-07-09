import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { maskEmail } from "../_shared/log-redact.ts";
import { getSubscriptionPricing, residentMultiplier } from "../_shared/pricing.ts";
import { getAppConfig } from "../_shared/appconfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CONSULTATION-CHECKOUT] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    if (stripeKey.startsWith("pk_")) {
      throw new Error("Invalid key: STRIPE_SECRET_KEY contains a publishable key. Need secret key (sk_*)");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);

    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: maskEmail(user.email) });

    // Feature gate (server-side, covers every UI surface): a paid consultation
    // ends in /chat, so if the admin disabled patient chat we must NOT charge —
    // otherwise the patient pays and lands on "feature unavailable".
    const { data: togglesRow } = await supabaseClient
      .from("site_settings").select("value").eq("id", "feature_toggles").maybeSingle();
    const toggles = (togglesRow?.value ?? {}) as Record<string, boolean>;
    if (toggles.enable_patient_chat !== true) {
      return new Response(
        JSON.stringify({ error: "La consulta por chat no está disponible en este momento." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { doctorId, doctorName, isDoubleCheck = false, fileIds = [], liveId, message } = await req.json();
    if (!doctorId) throw new Error("doctorId is required");

    // Segunda opinión pagada con tarjeta: los ids de los estudios a compartir viajan
    // en metadata (Stripe limita cada valor a 500 chars → capamos a ~12 UUIDs, que
    // cubre de sobra un expediente típico). El webhook los usa para dar acceso.
    const fileIdsCsv = Array.isArray(fileIds)
      ? fileIds.filter((x: unknown) => typeof x === 'string').slice(0, 12).join(',')
      : '';

    // Reserva desde un LIVE con tarjeta: antes se ignoraba liveId/message → el
    // mensaje del paciente se perdía y NO se aplicaba el límite max_paid_chats.
    // Aquí aplicamos el límite ANTES de cobrar; el webhook registra la orientación.
    const isLive = !!liveId;
    if (isLive) {
      const { data: liveRow } = await supabaseClient
        .from("lives")
        .select("max_paid_chats, paid_chats_count, chat_enabled")
        .eq("id", liveId)
        .maybeSingle();
      if (liveRow?.chat_enabled === false) {
        return new Response(JSON.stringify({ error: "El chat de este live está desactivado." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (liveRow?.max_paid_chats != null && Number(liveRow.paid_chats_count) >= Number(liveRow.max_paid_chats)) {
        return new Response(JSON.stringify({ error: "Este live alcanzó su límite de orientaciones pagadas." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }
    const liveMessage = typeof message === 'string' ? message.trim().slice(0, 480) : '';

    // Price and eligibility are SERVER-SIDE: never trust the fee from the body
    // (before, a user could pay $1 for any consultation), and only charge for an
    // APPROVED doctor.
    const { data: docProfile } = await supabaseClient
      .from("doctor_profiles")
      .select("consultation_fee, status")
      .eq("user_id", doctorId)
      .maybeSingle();
    if (!docProfile) throw new Error("Doctor not found");
    if (docProfile.status !== "approved") throw new Error("Doctor is not available for consultations");
    const consultationFee = Number(docProfile.consultation_fee);
    if (!consultationFee || consultationFee <= 0) throw new Error("Consultation fee not configured");

    logStep("Consultation request", { doctorId, consultationFee, doctorName });

    // Check if user is a resident (50% discount)
    const { data: userRole } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    let finalPrice = consultationFee * 100; // Convert to cents
    if (userRole?.role === 'resident') {
      const pricing = await getSubscriptionPricing(supabaseClient);
      finalPrice = Math.round(finalPrice * residentMultiplier(pricing));
      logStep("Resident discount applied", { originalPrice: consultationFee * 100, finalPrice });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-03-31.basil" });
    const appCfg = await getAppConfig(supabaseClient);

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: appCfg.currency,
            product_data: {
              name: isDoubleCheck ? `Segunda opinión con ${doctorName || 'Doctor'}` : `Consulta con ${doctorName || 'Doctor'}`,
              description: isDoubleCheck
                ? "Segunda opinión médica por chat con estudios compartidos"
                : "Consulta médica por chat con un profesional de la salud verificado",
            },
            unit_amount: finalPrice,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/chat?consultation=success&doctor=${doctorId}`,
      cancel_url: `${req.headers.get("origin")}/doctor/${doctorId}?consultation=canceled`,
      metadata: {
        user_id: user.id,
        doctor_id: doctorId,
        type: isDoubleCheck ? "double_check_payment" : (isLive ? "live_consultation_payment" : "consultation_payment"),
        original_fee: consultationFee.toString(),
        final_fee: (finalPrice / 100).toString(),
        ...(isDoubleCheck ? { file_ids: fileIdsCsv } : {}),
        ...(isLive ? { live_id: liveId, live_message: liveMessage } : {}),
      },
    });

    logStep("Checkout session created", { sessionId: session.id });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
