import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { Resend } from "npm:resend@2.0.0";
import { renderEmail, detailTable } from "../_shared/email-template.ts";

// ============================================================================
// Marketplace dr↔dr — ÓRDENES DE COMPRA SIN PREPAGO (cliente 2026-07-01)
// ----------------------------------------------------------------------------
// "Estoy interesado" NO cobra nada al comprador: genera una orden de compra al
// vendedor, abre el chat y notifica a TODOS (vendedor, comprador y admins, con
// campanilla + email a admins). Cierran pormenores por chat; cuando el
// vendedor CONCRETA la venta (sin método de pago de por medio) la orden queda
// 'completed' y nace la obligación del VENDEDOR de pagar el fee de la
// plataforma (fee_status pending → checkout Stripe → webhook la marca paid).
//
// Acciones (POST { action, ... }):
//   create   { product_id, terms_accepted }  → comprador crea la orden
//   complete { interest_id }                 → vendedor (o admin) concreta la venta
//   cancel   { interest_id }                 → comprador/vendedor/admin cancela
//   pay_fee  { interest_id }                 → vendedor paga su fee (Stripe URL)
// ============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const APP_URL = "https://medical-masters.com";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "Medical Masters <noreply@notify.medical-masters.com>";

type Db = ReturnType<typeof createClient>;

const money = (n: number, cur = "MXN") => `$${Number(n).toLocaleString("es-MX")} ${cur}`;

async function notifyUsers(db: Db, userIds: string[], title: string, message: string, data: Record<string, unknown>) {
  const rows = [...new Set(userIds)].filter(Boolean).map((user_id) => ({
    user_id, type: "system", title, message, data,
  }));
  if (rows.length === 0) return;
  const { error } = await db.from("notifications").insert(rows);
  if (error) console.error("[marketplace-order] notify error", error.message);
}

async function adminIds(db: Db): Promise<string[]> {
  const { data } = await db.from("user_roles").select("user_id").eq("role", "admin");
  return (data || []).map((r: { user_id: string }) => r.user_id);
}

// Email best-effort a todos los administradores ("todo se debe notificar").
async function emailAdmins(db: Db, subject: string, opts: { eyebrow: string; title: string; bodyHtml: string; accent?: "success" | "info" | "warning" }) {
  try {
    const key = Deno.env.get("RESEND_API_KEY");
    if (!key) return;
    const ids = await adminIds(db);
    if (ids.length === 0) return;
    const { data: profs } = await db.from("profiles").select("email").in("id", ids);
    const emails = (profs || []).map((p: { email: string | null }) => p.email).filter(Boolean) as string[];
    if (emails.length === 0) return;
    const resend = new Resend(key);
    await resend.emails.send({
      from: FROM_EMAIL,
      to: emails,
      subject,
      html: renderEmail({
        preheader: subject,
        accent: opts.accent ?? "info",
        eyebrow: opts.eyebrow,
        title: opts.title,
        bodyHtml: opts.bodyHtml,
        ctaText: "Ver en el panel",
        ctaUrl: `${APP_URL}/admin/marketplace-fee`,
      }),
    });
  } catch (e) {
    console.error("[marketplace-order] emailAdmins error", e instanceof Error ? e.message : e);
  }
}

async function roleTypeOf(db: Db, uid: string): Promise<"doctor" | "resident"> {
  const { data: rr } = await db.from("user_roles").select("role").eq("user_id", uid);
  const rs = (rr || []).map((r: { role: string }) => r.role);
  return rs.includes("resident") && !rs.includes("doctor") ? "resident" : "doctor";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const anon = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");
  const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await anon.auth.getUser(token);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");

    const body = await req.json();
    const action = body.action as string;

    const { data: roleRows } = await db.from("user_roles").select("role").eq("user_id", user.id);
    const roles = (roleRows || []).map((r: { role: string }) => r.role);
    const isAdmin = roles.includes("admin");
    if (!roles.includes("doctor") && !roles.includes("resident") && !isAdmin) {
      throw new Error("Solo doctores y residentes pueden usar el marketplace");
    }

    const { data: buyerProf } = await db.from("profiles").select("name").eq("id", user.id).maybeSingle();
    const callerName = buyerProf?.name || "Un colega";

    // ── CREATE: orden de compra sin pago ───────────────────────────────────
    if (action === "create") {
      const { product_id, terms_accepted } = body;
      if (!product_id) throw new Error("product_id is required");
      if (terms_accepted !== true) throw new Error("Debes aceptar los términos y condiciones");

      const { data: product, error: prodErr } = await db
        .from("marketplace_products")
        .select("id, name, price, currency, image_url, vendor_id, is_active, approval_status, listing_type, marketplace_vendors(name, user_id, status)")
        .eq("id", product_id)
        .single();
      if (prodErr || !product) throw new Error("Producto no encontrado");
      if (!product.is_active) throw new Error("Producto no disponible");
      if ((product as any).listing_type && (product as any).listing_type !== "fee") {
        throw new Error("Este producto se vende por la tienda, no por orden de compra");
      }
      // Solo se puede ordenar sobre productos aprobados por el administrador
      // y de proveedores con verificación vigente.
      if ((product as any).approval_status && (product as any).approval_status !== "approved") {
        throw new Error("Este producto aún está en revisión del administrador");
      }
      if ((product as any).marketplace_vendors?.status && (product as any).marketplace_vendors.status !== "approved") {
        throw new Error("El proveedor de este producto no está verificado");
      }
      const vendorUserId = (product as any).marketplace_vendors?.user_id as string | undefined;
      const vendorName = (product as any).marketplace_vendors?.name as string | undefined;
      if (vendorUserId === user.id) throw new Error("No puedes ordenar tu propio producto");

      // Idempotencia: si ya tiene una orden activa sobre este producto, devolverla.
      const { data: existing } = await db
        .from("product_interests")
        .select("id, chat_session_id")
        .eq("product_id", product.id)
        .eq("buyer_id", user.id)
        .eq("status", "ordered")
        .maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ interest_id: existing.id, chat_session_id: existing.chat_session_id, already: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
        });
      }

      // Snapshot del fee (lo pagará el VENDEDOR si la venta se concreta).
      const { data: cfg } = await db.from("marketplace_config").select("fee_rate, currency").eq("id", true).single();
      const feeRate = Number(cfg?.fee_rate ?? 0.1);
      const price = Number(product.price);
      const feeAmount = Math.round(price * feeRate * 100) / 100;
      const currency = product.currency || cfg?.currency || "MXN";

      const now = new Date().toISOString();

      // Chat comprador ↔ proveedor abierto DE INMEDIATO (sin pago de por medio).
      let chatSessionId: string | null = null;
      if (vendorUserId) {
        const { data: chat, error: chatErr } = await db
          .from("chat_sessions")
          .insert({
            participant1_id: user.id,
            participant1_type: await roleTypeOf(db, user.id),
            participant2_id: vendorUserId,
            participant2_type: await roleTypeOf(db, vendorUserId),
            status: "active",
            last_message: `Orden de compra: ${product.name}`,
            last_message_at: now,
          })
          .select("id")
          .single();
        if (chatErr) console.error("[marketplace-order] chat error (non-critical)", chatErr.message);
        chatSessionId = chat?.id ?? null;
      }

      const { data: interest, error: intErr } = await db
        .from("product_interests")
        .insert({
          product_id: product.id,
          vendor_id: product.vendor_id,
          buyer_id: user.id,
          fee_amount: feeAmount,
          fee_rate: feeRate,
          product_price: price,
          currency,
          terms_accepted: true,
          status: "ordered",
          fee_status: "none",
          chat_session_id: chatSessionId,
        })
        .select("id")
        .single();
      if (intErr || !interest) throw new Error("No se pudo registrar la orden de compra");

      // Enlazar el chat con la orden (tab "Proveedores").
      if (chatSessionId) {
        await db.from("chat_sessions").update({ marketplace_interest_id: interest.id }).eq("id", chatSessionId);
      }

      // Notificaciones: vendedor (orden de compra), comprador (confirmación) y admins.
      // URL con ?session= para abrir DIRECTO la conversación (además, en el
      // chat de residentes el filtro default excluye proveedores; el query
      // param fuerza el salto al filtro correcto).
      const chatUrl = chatSessionId ? `/chat?session=${chatSessionId}` : "/chat";
      if (vendorUserId) {
        await notifyUsers(db, [vendorUserId], "📋 Nueva orden de compra",
          `${callerName} está interesado en "${product.name}" (${money(price, currency)}). Abre el chat para acordar los pormenores.`,
          { url: chatUrl, interest_id: interest.id });
      }
      await notifyUsers(db, [user.id], "✅ Orden de compra enviada",
        `Tu orden por "${product.name}" llegó a ${vendorName || "el proveedor"}. Ya puedes chatear con él para acordar los detalles.`,
        { url: chatUrl, interest_id: interest.id });
      const admins = await adminIds(db);
      await notifyUsers(db, admins, "🛒 Marketplace: nueva orden de compra",
        `${callerName} ordenó "${product.name}" de ${vendorName || "un proveedor"} (${money(price, currency)}).`,
        { url: "/admin/marketplace-fee", interest_id: interest.id });
      await emailAdmins(db, `Marketplace: nueva orden de compra — ${product.name}`, {
        eyebrow: "NUEVA ORDEN",
        title: "Nueva orden de compra en el marketplace",
        bodyHtml: detailTable([
          ["Producto", product.name],
          ["Precio", money(price, currency)],
          ["Comprador", callerName],
          ["Proveedor", vendorName || "—"],
          ["Fee al concretarse", `${money(feeAmount, currency)} (${Math.round(feeRate * 100)}%)`],
        ]),
      });

      return new Response(JSON.stringify({ interest_id: interest.id, chat_session_id: chatSessionId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    // ── Resto de acciones: cargar la orden y validar quién llama ───────────
    const interestId = body.interest_id as string;
    if (!interestId) throw new Error("interest_id is required");
    const { data: order, error: ordErr } = await db
      .from("product_interests")
      .select("id, status, fee_status, fee_amount, product_price, currency, buyer_id, vendor_id, product_id, chat_session_id, marketplace_products!product_interests_product_id_fkey(name, stock, is_active), marketplace_vendors(name, user_id)")
      .eq("id", interestId)
      .single();
    if (ordErr || !order) throw new Error("Orden no encontrada");

    const vendorUserId = (order as any).marketplace_vendors?.user_id as string | undefined;
    const vendorName = (order as any).marketplace_vendors?.name as string | undefined;
    const productName = (order as any).marketplace_products?.name as string | undefined;
    const isVendor = vendorUserId === user.id;
    const isBuyer = order.buyer_id === user.id;

    const { data: buyerP } = await db.from("profiles").select("name").eq("id", order.buyer_id).maybeSingle();
    const buyerName = buyerP?.name || "el comprador";
    const admins = await adminIds(db);

    // ── COMPLETE: el vendedor concreta la venta (sin pago de por medio) ────
    if (action === "complete") {
      if (!isVendor && !isAdmin) throw new Error("Solo el proveedor puede concretar esta venta");
      if (order.status !== "ordered") throw new Error("Esta orden ya no está activa");

      const now = new Date().toISOString();
      await db.from("product_interests").update({
        status: "completed",
        completed_at: now,
        fee_status: "pending",
      }).eq("id", order.id);

      // Descontar la unidad vendida; sin stock → el producto sale del marketplace.
      const stock = Number((order as any).marketplace_products?.stock ?? 1);
      const newStock = Math.max(0, stock - 1);
      await db.from("marketplace_products").update({
        stock: newStock,
        is_active: newStock > 0,
        reserved_by: order.buyer_id,
        reserved_at: now,
        reserved_interest_id: order.id,
      }).eq("id", order.product_id);

      // Si se agotó, cancelar (y avisar) las demás órdenes activas del producto.
      if (newStock === 0) {
        const { data: others } = await db
          .from("product_interests")
          .select("id, buyer_id")
          .eq("product_id", order.product_id)
          .eq("status", "ordered")
          .neq("id", order.id);
        for (const o of others || []) {
          await db.from("product_interests").update({ status: "cancelled", cancelled_at: now }).eq("id", o.id);
          await notifyUsers(db, [o.buyer_id], "😔 Producto ya no disponible",
            `"${productName || "El producto"}" se vendió a otro comprador y tu orden fue cancelada.`,
            { url: "/marketplace" });
        }
      }

      const feeTxt = money(Number(order.fee_amount), order.currency);
      await notifyUsers(db, [order.buyer_id], "🎉 Venta concretada",
        `${vendorName || "El proveedor"} concretó tu compra de "${productName || "el producto"}". Coordina la entrega por el chat.`,
        { url: order.chat_session_id ? `/chat?session=${order.chat_session_id}` : "/chat", interest_id: order.id });
      if (vendorUserId) {
        await notifyUsers(db, [vendorUserId], "🤝 Venta concretada — fee pendiente",
          `Concretaste la venta de "${productName || "tu producto"}" a ${buyerName}. Recuerda pagar el fee de la plataforma (${feeTxt}) desde el marketplace.`,
          { url: "/marketplace", interest_id: order.id });
      }
      await notifyUsers(db, admins, "💰 Marketplace: venta concretada",
        `${vendorName || "Un proveedor"} concretó la venta de "${productName || "un producto"}" a ${buyerName}. Fee por cobrar: ${feeTxt}.`,
        { url: "/admin/marketplace-fee", interest_id: order.id });
      await emailAdmins(db, `Marketplace: venta concretada — ${productName || "producto"}`, {
        eyebrow: "VENTA CONCRETADA",
        accent: "success",
        title: "Venta concretada en el marketplace",
        bodyHtml: detailTable([
          ["Producto", productName || "—"],
          ["Precio", money(Number(order.product_price), order.currency)],
          ["Proveedor", vendorName || "—"],
          ["Comprador", buyerName],
          ["Fee por cobrar al proveedor", feeTxt],
        ]),
      });

      return new Response(JSON.stringify({ ok: true, fee_amount: order.fee_amount }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    // ── CANCEL: comprador, vendedor o admin cancelan la orden ──────────────
    if (action === "cancel") {
      if (!isBuyer && !isVendor && !isAdmin) throw new Error("No puedes cancelar esta orden");
      if (order.status !== "ordered") throw new Error("Esta orden ya no está activa");

      await db.from("product_interests").update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
      }).eq("id", order.id);

      const who = isBuyer ? buyerName : (vendorName || "el proveedor");
      const counterpart = isBuyer ? vendorUserId : order.buyer_id;
      if (counterpart) {
        await notifyUsers(db, [counterpart], "❌ Orden de compra cancelada",
          `${who} canceló la orden por "${productName || "el producto"}".`,
          { url: "/marketplace", interest_id: order.id });
      }
      await notifyUsers(db, admins, "❌ Marketplace: orden cancelada",
        `${who} canceló la orden por "${productName || "un producto"}" (${vendorName || "proveedor"} ↔ ${buyerName}).`,
        { url: "/admin/marketplace-fee", interest_id: order.id });

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    // ── PAY_FEE: el VENDEDOR paga el fee de la venta concretada ────────────
    if (action === "pay_fee") {
      if (!isVendor && !isAdmin) throw new Error("Solo el proveedor paga el fee de esta venta");
      if (order.status !== "completed") throw new Error("La venta aún no está concretada");
      if (order.fee_status === "paid") throw new Error("El fee de esta venta ya fue pagado");

      const feeAmount = Number(order.fee_amount);
      if (!(feeAmount > 0)) throw new Error("El fee calculado es inválido");
      const currency = (order.currency || "MXN").toLowerCase();

      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
        apiVersion: "2025-08-27.basil",
      });
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      const customerId = customers.data.length > 0 ? customers.data[0].id : undefined;

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        line_items: [{
          price_data: {
            currency,
            product_data: {
              name: `Fee de venta — ${productName || "producto"}`,
              description: `Comisión de la plataforma por la venta concretada a ${buyerName}`,
            },
            unit_amount: Math.round(feeAmount * 100),
          },
          quantity: 1,
        }],
        mode: "payment",
        success_url: `${req.headers.get("origin") || APP_URL}/marketplace?fee_paid=1`,
        cancel_url: `${req.headers.get("origin") || APP_URL}/marketplace?fee_canceled=1`,
        metadata: {
          type: "marketplace_sale_fee",
          interest_id: order.id,
          vendor_id: order.vendor_id,
          buyer_id: order.buyer_id,
          product_id: order.product_id,
          fee_amount: feeAmount.toString(),
        },
      });

      await db.from("product_interests").update({ fee_stripe_session_id: session.id }).eq("id", order.id);

      return new Response(JSON.stringify({ url: session.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    throw new Error(`Acción desconocida: ${action}`);
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
