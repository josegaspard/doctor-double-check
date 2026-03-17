import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

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
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) throw new Error("Unauthorized");

    const { liveId, amount, messageContent, userName } = await req.json();
    if (!liveId || !amount || !messageContent) throw new Error("Missing required fields");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2023-10-16",
    });

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

    // Fetch live settings for highlight duration
    const { data: liveData } = await supabase
      .from("lives")
      .select("title, chat_highlight_seconds")
      .eq("id", liveId)
      .single();

    const highlightSeconds = liveData?.chat_highlight_seconds || 120;
    const originUrl = req.headers.get("origin") || "https://doc-seek-relay.lovable.app";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "mxn",
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
