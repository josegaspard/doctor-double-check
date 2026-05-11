import { requireAdminJWT, AuthError, corsHeaders } from "../_shared/auth-guards.ts";
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SETUP-CLOUDFLARE-WEBHOOK] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // SECURITY (2026-05-11 audit): admin-only. Previously open.
  try { await requireAdminJWT(req); } catch (__e) {
    if (__e instanceof AuthError) return __e.toResponse();
    return new Response(JSON.stringify({ error: 'auth failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    logStep("Setting up Cloudflare webhook");

    const cfAccountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
    const cfApiToken = Deno.env.get("CLOUDFLARE_API_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    if (!cfAccountId || !cfApiToken) {
      throw new Error("Cloudflare credentials not configured");
    }

    if (!supabaseUrl) {
      throw new Error("Supabase URL not configured");
    }

    // The webhook URL for our cloudflare-webhook edge function
    const webhookUrl = `${supabaseUrl}/functions/v1/cloudflare-webhook`;

    logStep("Webhook URL", { webhookUrl });

    // First, list existing webhooks to see if one already exists
    const listResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/stream/webhook`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${cfApiToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const listData = await listResponse.json();
    logStep("Existing webhooks", listData);

    // Create or update the webhook
    const webhookPayload = {
      notificationUrl: webhookUrl,
    };

    const createResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/stream/webhook`,
      {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${cfApiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(webhookPayload),
      }
    );

    const createData = await createResponse.json();
    logStep("Webhook creation response", createData);

    if (!createData.success) {
      throw new Error(`Failed to create webhook: ${JSON.stringify(createData.errors)}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Webhook configured successfully",
        webhookUrl,
        response: createData,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
