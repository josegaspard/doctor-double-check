import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SEPResponse {
  responseHeader: {
    status: number;
  };
  response: {
    numFound: number;
    docs: Array<{
      nombre: string;
      paterno: string;
      materno: string;
      numCedula: string;
      titulo: string;
      institucion: string;
      anioRegistro: number;
      genero: string;
      tipo: string;
    }>;
  };
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

    // Query SEP API
    const sepUrl = `http://search.sep.gob.mx/solr/cedulasCore/select?fl=%2A%2Cscore&q=${encodeURIComponent(cedula)}&start=0&rows=10&facet=true&indent=on&wt=json`;
    
    console.log("Querying SEP API:", sepUrl);
    
    const sepResponse = await fetch(sepUrl, {
      headers: {
        "Accept": "application/json",
      },
    });

    if (!sepResponse.ok) {
      console.error("SEP API error:", sepResponse.status);
      throw new Error("Error al consultar el sistema SEP");
    }

    const sepData: SEPResponse = await sepResponse.json();
    console.log("SEP Response:", JSON.stringify(sepData, null, 2));

    // Find exact match by cedula number
    const exactMatch = sepData.response.docs.find(
      (doc) => doc.numCedula === cedula
    );

    if (!exactMatch) {
      return new Response(
        JSON.stringify({
          success: false,
          verified: false,
          error: "Cédula no encontrada en el registro de la SEP",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
      nombre: exactMatch.nombre,
      paterno: exactMatch.paterno,
      materno: exactMatch.materno,
      titulo: exactMatch.titulo,
      institucion: exactMatch.institucion,
      anio_registro: exactMatch.anioRegistro,
      is_verified: true,
      verified_at: new Date().toISOString(),
      raw_response: exactMatch,
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
          nombre: exactMatch.nombre,
          paterno: exactMatch.paterno,
          materno: exactMatch.materno,
          titulo: exactMatch.titulo,
          institucion: exactMatch.institucion,
          anioRegistro: exactMatch.anioRegistro,
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
