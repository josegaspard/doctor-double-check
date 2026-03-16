import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if rates were updated recently (within 1 hour)
    const { data: recentRate } = await supabase
      .from("exchange_rates")
      .select("updated_at")
      .limit(1)
      .single();

    if (recentRate) {
      const lastUpdate = new Date(recentRate.updated_at);
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (lastUpdate > hourAgo) {
        // Return cached rates
        const { data: rates } = await supabase
          .from("exchange_rates")
          .select("target_currency, rate, updated_at");
        return new Response(JSON.stringify({ rates, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fetch fresh rates from free API
    const response = await fetch("https://open.er-api.com/v6/latest/MXN");
    if (!response.ok) throw new Error("Failed to fetch exchange rates");

    const data = await response.json();
    const rates = data.rates;

    // Key currencies to cache
    const currencies = ["USD", "EUR", "GBP", "BRL", "COP", "ARS", "PEN", "CLP", "UYU", "BOB", "PYG", "CRC", "GTQ", "HNL", "NIO", "DOP", "PAB", "CAD"];

    const upsertData = currencies
      .filter((c) => rates[c])
      .map((currency) => ({
        base_currency: "MXN",
        target_currency: currency,
        rate: rates[currency],
        updated_at: new Date().toISOString(),
      }));

    const { error } = await supabase
      .from("exchange_rates")
      .upsert(upsertData, { onConflict: "base_currency,target_currency" });

    if (error) throw error;

    return new Response(
      JSON.stringify({ rates: upsertData, cached: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
