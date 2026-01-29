import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      throw new Error("Usuario no autenticado");
    }

    const userId = userData.user.id;
    const { verificationId } = await req.json();

    if (!verificationId) {
      throw new Error("ID de verificación requerido");
    }

    // Use service role to update
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get the verification record
    const { data: verification, error: verifyError } = await supabaseAdmin
      .from("cedula_verifications")
      .select("*")
      .eq("id", verificationId)
      .eq("user_id", userId)
      .single();

    if (verifyError || !verification) {
      throw new Error("Verificación no encontrada");
    }

    if (!verification.is_verified) {
      throw new Error("La cédula no ha sido verificada");
    }

    if (verification.is_claimed) {
      throw new Error("Esta cédula ya fue reclamada");
    }

    // Check if cedula is already claimed by someone else
    const { data: existingClaim } = await supabaseAdmin
      .from("cedula_verifications")
      .select("id")
      .eq("cedula_number", verification.cedula_number)
      .eq("is_claimed", true)
      .neq("user_id", userId)
      .maybeSingle();

    if (existingClaim) {
      throw new Error("Esta cédula ya fue reclamada por otro usuario");
    }

    // Claim the cedula
    const { error: claimError } = await supabaseAdmin
      .from("cedula_verifications")
      .update({
        is_claimed: true,
        claimed_by: userId,
        claimed_at: new Date().toISOString(),
      })
      .eq("id", verificationId);

    if (claimError) throw claimError;

    // Update doctor profile with the verification ID and auto-approve
    const { error: profileError } = await supabaseAdmin
      .from("doctor_profiles")
      .update({
        cedula_verification_id: verificationId,
        cedula_profesional: verification.cedula_number,
        status: "approved", // Auto-approve verified doctors
      })
      .eq("user_id", userId);

    if (profileError) {
      console.error("Error updating doctor profile:", profileError);
      // Don't throw, the claim was successful
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Cédula reclamada exitosamente. Tu perfil ha sido verificado automáticamente.",
        autoApproved: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in claim-cedula:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Error al reclamar cédula",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
