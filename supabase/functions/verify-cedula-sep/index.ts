import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RapidAPIResponse {
  success: boolean;
  data?: {
    cedula: string;
    nombre: string;
    paterno: string;
    materno: string;
    titulo: string;
    institucion: string;
    anioRegistro: number;
    tipo: string;
  };
  message?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cedula, userId } = await req.json();

    if (!cedula || !userId) {
      throw new Error("Cédula y userId son requeridos");
    }

    // Validate cedula format (7-8 digits)
    const cedulaRegex = /^\d{7,8}$/;
    if (!cedulaRegex.test(cedula)) {
      throw new Error("Formato de cédula inválido. Debe contener 7-8 dígitos");
    }

    const rapidApiKey = Deno.env.get("RAPIDAPI_KEY");
    if (!rapidApiKey) {
      throw new Error("RAPIDAPI_KEY no configurada");
    }

    // Query RapidAPI endpoint
    const apiUrl = `https://cedulas-profesionales-sep.p.rapidapi.com/api/v1/sep/cedula?cedula=${encodeURIComponent(cedula)}`;
    
    console.log("Querying RapidAPI:", apiUrl);
    
    const apiResponse = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "x-rapidapi-host": "cedulas-profesionales-sep.p.rapidapi.com",
        "x-rapidapi-key": rapidApiKey,
      },
    });

    if (!apiResponse.ok) {
      console.error("RapidAPI error:", apiResponse.status, await apiResponse.text());
      throw new Error("Error al consultar el servicio de verificación");
    }

    const apiData: RapidAPIResponse = await apiResponse.json();
    console.log("RapidAPI Response:", JSON.stringify(apiData, null, 2));

    if (!apiData.success || !apiData.data) {
      return new Response(
        JSON.stringify({
          success: false,
          verified: false,
          error: apiData.message || "Cédula no encontrada en el registro de la SEP",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const matchedData = apiData.data;

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check if cedula is already claimed by someone else
    const { data: existingClaim } = await supabaseClient
      .from("cedula_verifications")
      .select("*")
      .eq("cedula_number", cedula)
      .eq("is_claimed", true)
      .single();

    if (existingClaim && existingClaim.user_id !== userId) {
      return new Response(
        JSON.stringify({
          success: false,
          verified: false,
          error: "Esta cédula ya fue verificada por otro usuario",
          alreadyClaimed: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create or update verification record
    const verificationData = {
      user_id: userId,
      cedula_number: cedula,
      nombre: matchedData.nombre,
      paterno: matchedData.paterno,
      materno: matchedData.materno,
      titulo: matchedData.titulo,
      institucion: matchedData.institucion,
      anio_registro: matchedData.anioRegistro,
      is_verified: true,
      verified_at: new Date().toISOString(),
      raw_response: matchedData,
    };

    // Check if user already has a verification for this cedula
    const { data: existingVerification } = await supabaseClient
      .from("cedula_verifications")
      .select("id")
      .eq("user_id", userId)
      .eq("cedula_number", cedula)
      .maybeSingle();

    let verificationId: string;

    if (existingVerification) {
      // Update existing
      const { data, error } = await supabaseClient
        .from("cedula_verifications")
        .update(verificationData)
        .eq("id", existingVerification.id)
        .select()
        .single();

      if (error) throw error;
      verificationId = data.id;
    } else {
      // Insert new
      const { data, error } = await supabaseClient
        .from("cedula_verifications")
        .insert(verificationData)
        .select()
        .single();

      if (error) throw error;
      verificationId = data.id;
    }

    return new Response(
      JSON.stringify({
        success: true,
        verified: true,
        verificationId,
        data: {
          nombre: matchedData.nombre,
          paterno: matchedData.paterno,
          materno: matchedData.materno,
          titulo: matchedData.titulo,
          institucion: matchedData.institucion,
          anioRegistro: matchedData.anioRegistro,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in verify-cedula-sep:", error);
    return new Response(
      JSON.stringify({
        success: false,
        verified: false,
        error: error.message || "Error al verificar cédula",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});