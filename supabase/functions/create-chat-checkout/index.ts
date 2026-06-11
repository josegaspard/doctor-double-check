import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { getAppConfig } from "../_shared/appconfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) throw new Error("Unauthorized");

    const { liveId, messageContent, userName } = await req.json();
    if (!liveId || !messageContent) throw new Error("Missing required fields");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2023-10-16",
    });
    const appCfg = await getAppConfig(supabase);

    // Get or create customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
    }

    // SECURITY (2026-05-11 audit): amount comes from DB, NOT from body.
    // Previously a user could pass amount=0.01 (or negative-rounded) and
    // get a chat highlight at the wrong price.
    const { data: liveData } = await supabase
      .from("lives")
      .select("title, chat_highlight_seconds, chat_highlight_price")
      .eq("id", liveId)
      .single();
    if (!liveData) throw new Error("Live not found");

    const highlightSeconds = liveData.chat_highlight_seconds || 120;
    const amount = Number((liveData as any).chat_highlight_price ?? 0);
    if (!amount || amount < 5 || amount > 5000) {
      throw new Error("Chat highlight price not configured");
    }
    const originUrl = req.headers.get("origin") || "https://medical-masters.com";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: appCfg.currency,
            unit_amount: Math.round(amount * 100),
            product_data: {
              name: `Chat destacado`,
              description: `Mensaje destacado en "${liveData?.title || "Live"}" por ${highlightSeconds}s`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: "live_chat_highlight",
        live_id: liveId,
        user_id: user.id,
        user_name: userName || "Usuario",
        message_content: messageContent.substring(0, 450),
        highlight_seconds: String(highlightSeconds),
        amount: String(amount),
      },
      success_url: `${originUrl}/live/${liveId}?chat_paid=success`,
      cancel_url: `${originUrl}/live/${liveId}?chat_paid=cancel`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
