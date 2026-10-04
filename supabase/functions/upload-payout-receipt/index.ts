import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is admin: 401 sin sesión, 403 sin rol admin.
    const deny = (status: number, error: string) =>
      new Response(JSON.stringify({ error }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return deny(401, "No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.getUser(token);
    if (authError || !authData.user) return deny(401, "Not authenticated");

    // Un usuario puede tener varios roles: .single() fallaba con 2 filas.
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", authData.user.id)
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();
    if (!roleData) return deny(403, "Unauthorized - admin access required");

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) throw new Error("No file provided");

    const ext = file.name.split(".").pop() || "pdf";
    const path = `receipts/${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabaseAdmin.storage
      .from("doctor-invoices")
      .upload(path, arrayBuffer, {
        contentType: file.type || "application/pdf",
        cacheControl: "3600",
      });

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    return new Response(JSON.stringify({ path }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error uploading receipt:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
