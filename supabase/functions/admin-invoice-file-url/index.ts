import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const normalizeInvoicePath = (rawFileUrl: string) => {
  if (!rawFileUrl) return "";

  const decoded = decodeURIComponent(rawFileUrl.trim());

  if (decoded.startsWith("http")) {
    const match = decoded.match(/\/(?:object\/(?:public|sign)\/)?doctor-invoices\/(.+?)(?:\?|$)/);
    if (match?.[1]) return match[1];

    const splitByBucket = decoded.split("/doctor-invoices/");
    if (splitByBucket.length > 1) {
      return splitByBucket[splitByBucket.length - 1].split("?")[0];
    }
  }

  return decoded.replace(/^doctor-invoices\//, "");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !authData.user) {
      throw new Error("User not authenticated");
    }

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", authData.user.id)
      .single();

    if (roleData?.role !== "admin") {
      throw new Error("Unauthorized");
    }

    const { invoiceId } = await req.json();
    if (!invoiceId) throw new Error("invoiceId is required");

    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("doctor_invoices")
      .select("id, file_url, file_name")
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      throw new Error("Invoice not found");
    }

    const normalizedPath = normalizeInvoicePath(invoice.file_url);
    if (!normalizedPath) {
      throw new Error("Invalid invoice file path");
    }

    const { data: signed, error: signedError } = await supabaseAdmin.storage
      .from("doctor-invoices")
      .createSignedUrl(normalizedPath, 60 * 60);

    if (signedError || !signed?.signedUrl) {
      throw new Error(signedError?.message || "Failed to create signed URL");
    }

    return new Response(
      JSON.stringify({
        signedUrl: signed.signedUrl,
        fileName: invoice.file_name,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Unexpected error" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
