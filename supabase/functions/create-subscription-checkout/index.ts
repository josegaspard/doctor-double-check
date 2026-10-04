import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { maskEmail } from "../_shared/log-redact.ts";
import { getSubscriptionPricing } from "../_shared/pricing.ts";
import { getAppConfig } from "../_shared/appconfig.ts";
import { requireBillingProfile } from "../_shared/billing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-SUBSCRIPTION-CHECKOUT] ${step}${detailsStr}`);
};

// Subscription tiers with prices in MXN
const SUBSCRIPTION_TIERS = {
  basic: {
    name: "Suscripción Básica",
    description: "Acceso a contenido exclusivo y notificaciones",
    price: 9900, // $99 MXN in cents
  },
  premium: {
    name: "Suscripción Premium",
    description: "Todo lo básico + descuentos en grabaciones y chats prioritarios",
    price: 19900, // $199 MXN in cents
  },
};

// ---------------------------------------------------------------------------
// Plan propio del médico (F2 «planes», 13-sep-2026 · migración 20260913b).
// Cada médico puede personalizar SUS dos niveles (basic/premium) en la tabla
// doctor_subscription_plans. Si hay un plan ACTIVO para (creatorId, tier) se
// cobra su price_cents y su nombre va en el producto de Stripe. En cualquier
// otro caso —sin plan, plan desactivado, tabla todavía inexistente, error de
// lectura o datos fuera de rango— devuelve null y se cobra EXACTAMENTE lo de
// antes (precio global de site_settings.subscription_pricing).
// Se lee con el mismo cliente anon de la función: la policy dsp_public_read
// deja leer los planes activos a cualquiera.
// ---------------------------------------------------------------------------
interface DoctorPlan {
  id: string;
  name: string;
  description: string;
  price_cents: number;
}

// Mismos límites que los CHECK de la migración.
const PLAN_MIN_CENTS = 1000;
const PLAN_MAX_CENTS = 500000;

async function getDoctorPlan(db: any, creatorId: string, tier: string): Promise<DoctorPlan | null> {
  try {
    const { data, error } = await db
      .from("doctor_subscription_plans")
      .select("id, name, description, price_cents")
      .eq("doctor_id", creatorId)
      .eq("tier", tier)
      .eq("is_active", true)
      .maybeSingle();
    if (error) {
      logStep("Doctor plan not available, using global price", { code: (error as any)?.code ?? null });
      return null;
    }
    if (!data) return null;
    const cents = Number(data.price_cents);
    const name = typeof data.name === "string" ? data.name.trim() : "";
    if (!Number.isInteger(cents) || cents < PLAN_MIN_CENTS || cents > PLAN_MAX_CENTS || !name) {
      logStep("Doctor plan ignored (invalid data), using global price", { planId: data.id ?? null });
      return null;
    }
    const description = typeof data.description === "string" ? data.description.trim() : "";
    return {
      id: String(data.id),
      name: name.slice(0, 60),
      description: description.slice(0, 280),
      price_cents: cents,
    };
  } catch (e) {
    logStep("Doctor plan lookup failed, using global price", { message: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);

    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: maskEmail(user.email) });

    // Facturas a nombre del comprador: sin RFC y nombre fiscal no se cobra.
    // billing_profiles solo lo lee su dueño por RLS: con el cliente anon (sin sesión)
    // la lectura sale vacía y bloquearía a todos, así que se lee con la clave de servicio.
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const billingBlock = await requireBillingProfile(adminClient, user.id, corsHeaders);
    if (billingBlock) return billingBlock;

    const { creatorId, tier } = await req.json();
    if (!creatorId) throw new Error("creatorId is required");
    if (!tier || !['basic', 'premium'].includes(tier)) throw new Error("Invalid tier. Use 'basic' or 'premium'");

    const tierConfig = SUBSCRIPTION_TIERS[tier as keyof typeof SUBSCRIPTION_TIERS];
    // Price is admin-editable (site_settings.subscription_pricing) with a hard
    // fallback to the historical $99/$199 if the setting is missing/invalid.
    const pricing = await getSubscriptionPricing(supabaseClient);
    const appCfg = await getAppConfig(supabaseClient);
    // Plan propio del médico para ese nivel (F2, migración 20260913b). Si no hay
    // plan activo, la tabla no existe o la lectura falla → null → precio global de hoy.
    const doctorPlan = await getDoctorPlan(supabaseClient, creatorId, tier);
    const unitAmount = doctorPlan
      ? doctorPlan.price_cents
      : (tier === 'premium' ? pricing.premium_cents : pricing.basic_cents);
    logStep("Subscription request", { creatorId, tier, price: unitAmount, planId: doctorPlan?.id ?? null });

    // Get creator info
    const { data: creatorProfile } = await supabaseClient
      .from('profiles_public')
      .select('name')
      .eq('id', creatorId)
      .single();

    const creatorName = creatorProfile?.name || 'Doctor';

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-03-31.basil" });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    }

    // plan_id solo viaja cuando se cobró el precio del plan del médico: el
    // webhook lo usa para registrar/acreditar ese precio en vez del global.
    // Sin plan, la metadata es idéntica a la de antes.
    const planMetadata: Record<string, string> = doctorPlan ? { plan_id: doctorPlan.id } : {};

    // Create checkout session using dynamic price_data (no hardcoded price IDs needed)
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: appCfg.currency,
            product_data: {
              name: `${doctorPlan ? doctorPlan.name : tierConfig.name} - ${creatorName}`,
              // Stripe no acepta una descripción vacía: sin descripción propia, la de siempre.
              description: doctorPlan?.description || tierConfig.description,
            },
            unit_amount: unitAmount,
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${req.headers.get("origin") || Deno.env.get("SITE_URL") || "https://medical-masters.com"}/doctor/${creatorId}?subscription=success`,
      cancel_url: `${req.headers.get("origin") || Deno.env.get("SITE_URL") || "https://medical-masters.com"}/doctor/${creatorId}?subscription=canceled`,
      metadata: {
        user_id: user.id,
        creator_id: creatorId,
        tier: tier,
        type: "creator_subscription",
        ...planMetadata,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          creator_id: creatorId,
          tier: tier,
          ...planMetadata,
        },
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
