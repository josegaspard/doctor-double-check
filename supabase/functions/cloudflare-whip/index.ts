import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type WhipAction = "post" | "delete";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CLOUDFLARE-WHIP] ${step}${detailsStr}`);
};

const isAllowedCloudflareUrl = (rawUrl: string) => {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    // Prevent SSRF: only allow Cloudflare Stream domains.
    return host.endsWith("cloudflarestream.com") || host.endsWith("cloudflare.com");
  } catch {
    return false;
  }
};

// Error con código HTTP: 400 validación, 401 sin sesión, 403 rol, 404 no existe.
const httpError = (status: number, message: string) => Object.assign(new Error(message), { status });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw httpError(401, "No authorization header");
    const token = authHeader.replace("Bearer ", "");

    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw httpError(401, "User not authenticated");
    logStep("User authenticated", { userId: userData.user.id });

    const body = await req.json().catch(() => ({}));
    const action = body?.action as WhipAction;
    const url = body?.url as string;

    if (!action || (action !== "post" && action !== "delete")) {
      throw httpError(400, "Invalid action. Expected 'post' or 'delete'.");
    }
    if (!url) throw httpError(400, "url is required");
    if (!isAllowedCloudflareUrl(url)) {
      throw httpError(400, "Invalid url host (only cloudflarestream.com is allowed)");
    }

    if (action === "post") {
      const sdp = body?.sdp as string;
      if (!sdp) throw httpError(400, "sdp is required for action=post");

      logStep("WHIP POST", { urlHost: new URL(url).hostname });
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/sdp",
          "Accept": "application/sdp",
        },
        body: sdp,
      });

      const answerSdp = await res.text();
      const locationHeader = res.headers.get("location");
      const resourceUrl = locationHeader
        ? new URL(locationHeader, url).toString()
        : null;

      if (!res.ok) {
        logStep("WHIP POST failed", { status: res.status, body: answerSdp.slice(0, 300) });
        return new Response(
          JSON.stringify({
            success: false,
            status: res.status,
            error: "WHIP POST failed",
            errorBody: answerSdp,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          },
        );
      }

      logStep("WHIP POST ok", { status: res.status, hasLocation: !!resourceUrl });
      return new Response(
        JSON.stringify({
          success: true,
          status: res.status,
          answerSdp,
          resourceUrl,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    // action === 'delete'
    logStep("WHIP DELETE", { urlHost: new URL(url).hostname });
    const res = await fetch(url, { method: "DELETE" });
    const text = await res.text().catch(() => "");

    logStep("WHIP DELETE result", { status: res.status });
    return new Response(
      JSON.stringify({
        success: res.ok,
        status: res.status,
        body: text,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: (error as any)?.status ?? 500,
      },
    );
  }
});
