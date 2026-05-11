// Claim a verified cedula for the current user. Delegates to the atomic SQL
// RPC `claim_cedula_atomic` so the (is_claimed = false) → (is_claimed = true)
// transition is serialized in Postgres + protected by a partial unique index
// on cedula_verifications(cedula_number) WHERE is_claimed = true. This closes
// the race where two users with the same cedula could both auto-approve.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) throw new Error("Usuario no autenticado");

    const { verificationId } = await req.json();
    if (!verificationId) throw new Error("ID de verificación requerido");

    const { data, error } = await userClient.rpc("claim_cedula_atomic", {
      p_verification_id: verificationId,
    });

    if (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = data as { success: boolean; error?: string; auto_approved?: boolean };
    if (!result.success) {
      return new Response(
        JSON.stringify({ success: false, error: result.error || "Error al reclamar cédula" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Cédula reclamada exitosamente. Tu perfil ha sido verificado automáticamente.",
        autoApproved: !!result.auto_approved,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in claim-cedula:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Error al reclamar cédula" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
