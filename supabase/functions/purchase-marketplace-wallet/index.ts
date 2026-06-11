import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PURCHASE-MARKETPLACE-WALLET] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await adminClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);

    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const { product_id, quantity = 1, shipping } = await req.json();
    if (!product_id) throw new Error("product_id is required");
    if (quantity < 1) throw new Error("quantity must be >= 1");

    // Fetch product
    const { data: product, error: prodErr } = await adminClient
      .from("marketplace_products")
      .select("id, name, price, currency, vendor_id, stock, is_active, marketplace_vendors(name)")
      .eq("id", product_id)
      .single();

    if (prodErr || !product) throw new Error("Product not found");
    if (!product.is_active) throw new Error("Product is not active");
    if (product.stock < quantity) throw new Error("Insufficient stock");

    const totalAmount = product.price * quantity;
    logStep("Product loaded", { name: product.name, totalAmount });

    // Use the same RPC used for recording purchases so wallet logic stays consistent
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: purchaseResult, error: purchaseError } = await userClient
      .rpc('process_wallet_purchase', {
        p_amount: totalAmount,
        p_description: `Producto: ${product.name}${quantity > 1 ? ` x${quantity}` : ''}`,
        p_metadata: {
          source: 'marketplace',
          product_id: product.id,
          vendor_id: product.vendor_id,
          quantity,
        },
      });

    if (purchaseError) throw new Error(purchaseError.message);
    if (!purchaseResult?.success) {
      throw new Error(purchaseResult?.error || "Wallet purchase failed");
    }

    logStep("Wallet charge succeeded", {
      amountCharged: purchaseResult.amount_charged,
      newBalance: purchaseResult.new_balance,
    });

    // Atomic relative stock decrement (no oversell under concurrency).
    const { data: stockOk, error: stockErr } = await adminClient.rpc("decrement_product_stock", {
      p_product_id: product.id,
      p_qty: quantity,
    });

    if (stockErr || !stockOk) {
      // Refund wallet — stock changed concurrently
      await adminClient.from('wallet_transactions').insert({
        user_id: user.id,
        type: 'refund',
        amount: purchaseResult.amount_charged,
        description: `Reembolso (stock agotado): ${product.name}`,
        status: 'paid',
        metadata: { source: 'marketplace', product_id: product.id, reason: 'stock_race' },
      });
      await adminClient.rpc('credit_wallet_balance', {
        p_user_id: user.id,
        p_amount: purchaseResult.amount_charged,
      }).catch(() => null);
      throw new Error("Stock changed, your wallet was refunded");
    }

    // Create marketplace order. Insert as 'pending' first, then flip to 'paid'
    // so the accounting/earnings trigger (AFTER UPDATE OF status) actually fires
    // — an INSERT straight into 'paid' never triggers it, so the vendor would
    // never get credited nor the sale booked.
    const { data: order, error: orderErr } = await adminClient
      .from('marketplace_orders')
      .insert({
        buyer_id: user.id,
        product_id: product.id,
        vendor_id: product.vendor_id,
        quantity,
        total_amount: totalAmount,
        status: 'pending',
        shipping_name: shipping?.name || null,
        shipping_phone: shipping?.phone || null,
        shipping_city: shipping?.city || null,
        shipping_state: shipping?.state || null,
        shipping_zip: shipping?.zip || null,
        shipping_notes: shipping?.notes || null,
      })
      .select('id')
      .single();

    if (orderErr || !order) {
      // Order failed AFTER the wallet was charged and stock decremented →
      // refund the wallet and restore stock so the buyer never loses money.
      logStep("Error creating order — refunding wallet + restoring stock", { error: orderErr?.message });
      await adminClient.from('wallet_transactions').insert({
        user_id: user.id,
        type: 'refund',
        amount: purchaseResult.amount_charged,
        description: `Reembolso (no se pudo crear la orden): ${product.name}`,
        status: 'paid',
        metadata: { source: 'marketplace', product_id: product.id, reason: 'order_create_failed' },
      });
      await adminClient.rpc('credit_wallet_balance', {
        p_user_id: user.id,
        p_amount: purchaseResult.amount_charged,
      }).catch(() => null);
      await adminClient.rpc('increment_product_stock', {
        p_product_id: product.id,
        p_qty: quantity,
      }).catch(() => null);
      throw new Error("No se pudo crear la orden; tu wallet fue reembolsado");
    } else {
      // Transition to 'paid' → fires fn_record_marketplace_earning (vendor
      // earnings + double-entry accounting). Stock was already decremented above
      // and the trigger no longer decrements it (no double discount).
      const { error: payErr } = await adminClient
        .from('marketplace_orders')
        .update({ status: 'paid' })
        .eq('id', order.id);
      if (payErr) {
        logStep("Error marking order paid", { orderId: order.id, error: payErr.message });
      } else {
        logStep("Order created and paid", { orderId: order.id });
      }
    }

    // Send purchase confirmation email (non-critical)
    try {
      await adminClient.functions.invoke('send-purchase-email', {
        body: {
          userId: user.id,
          purchaseType: 'marketplace',
          itemTitle: product.name,
          amount: purchaseResult.amount_charged,
        },
      });
    } catch (emailError) {
      logStep("Email sending failed (non-critical)", { error: String(emailError) });
    }

    return new Response(
      JSON.stringify({
        success: true,
        amountCharged: purchaseResult.amount_charged,
        newBalance: purchaseResult.new_balance,
        orderId: order?.id,
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
