import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

// ============================================================================
// "Estoy interesado" — cobro del FEE de intermediación (cliente 2026-07-01)
// ----------------------------------------------------------------------------
// El comprador (doctor/residente) paga SOLO el fee de la plataforma por Stripe
// (a la MISMA cuenta del sitio = super admin, sin Stripe Connect). Al pagar, el
// webhook aparta el producto y abre el chat con el proveedor. El vendedor cobra
// el producto POR FUERA. Fee = precio × fee_rate (config global del admin).
// ============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");

    const { product_id, terms_accepted } = await req.json();
    if (!product_id) throw new Error("product_id is required");
    if (terms_accepted !== true) throw new Error("Debes aceptar los términos y condiciones");

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Solo doctores/residentes pueden apartar (el marketplace es dr↔dr).
    const { data: roleRows } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const roles = (roleRows || []).map((r: { role: string }) => r.role);
    const isDoctorOrResident = roles.includes("doctor") || roles.includes("resident") || roles.includes("admin");
    if (!isDoctorOrResident) throw new Error("Solo doctores y residentes pueden apartar productos");

    // Producto activo y no apartado por alguien más.
    const { data: product, error: prodErr } = await serviceClient
      .from("marketplace_products")
      .select("id, name, price, currency, image_url, vendor_id, is_active, reserved_by, reserved_until, marketplace_vendors(name, user_id)")
      .eq("id", product_id)
      .single();

    if (prodErr || !product) throw new Error("Producto no encontrado");
    if (!product.is_active) throw new Error("Producto no disponible");
    if (product.vendor_id && (product as any).marketplace_vendors?.user_id === user.id) {
      throw new Error("No puedes apartar tu propio producto");
    }
    const reservedActive = product.reserved_by && product.reserved_until && new Date(product.reserved_until) > new Date();
    if (reservedActive && product.reserved_by !== user.id) {
      throw new Error("Este producto ya está apartado por otro comprador");
    }

    // Fee global configurable por el admin.
    const { data: cfg } = await serviceClient
      .from("marketplace_config")
      .select("fee_rate, currency")
      .eq("id", true)
      .single();
    const feeRate = Number(cfg?.fee_rate ?? 0.1);
    const price = Number(product.price);
    const feeAmount = Math.round(price * feeRate * 100) / 100;
    if (!(feeAmount > 0)) throw new Error("El fee calculado es inválido");
    const currency = (product.currency || cfg?.currency || "MXN").toLowerCase();

    // Registro del interés en estado pendiente de pago.
    const { data: interest, error: intErr } = await serviceClient
      .from("product_interests")
      .insert({
        product_id: product.id,
        vendor_id: product.vendor_id,
        buyer_id: user.id,
        fee_amount: feeAmount,
        fee_rate: feeRate,
        product_price: price,
        currency: (product.currency || cfg?.currency || "MXN"),
        terms_accepted: true,
        status: "pending_payment",
      })
      .select("id")
      .single();
    if (intErr || !interest) throw new Error("No se pudo registrar el interés");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data.length > 0 ? customers.data[0].id : undefined;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `Cuota de intermediación — ${product.name}`,
              description: (product as any).marketplace_vendors?.name
                ? `Contacto con ${(product as any).marketplace_vendors.name}`
                : "Desbloquea el contacto con el proveedor",
              images: product.image_url ? [product.image_url] : undefined,
            },
            unit_amount: Math.round(feeAmount * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/marketplace?interest=${interest.id}&paid=1`,
      cancel_url: `${req.headers.get("origin")}/marketplace?canceled=1`,
      metadata: {
        type: "marketplace_interest_fee",
        interest_id: interest.id,
        product_id: product.id,
        vendor_id: product.vendor_id,
        buyer_id: user.id,
        fee_amount: feeAmount.toString(),
      },
    });

    await serviceClient
      .from("product_interests")
      .update({ stripe_session_id: session.id })
      .eq("id", interest.id);

    return new Response(JSON.stringify({ url: session.url, interest_id: interest.id, fee_amount: feeAmount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
