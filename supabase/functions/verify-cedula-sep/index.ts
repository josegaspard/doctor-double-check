import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SolrDoc {
  nombre: string;
  paterno: string;
  materno: string;
  numCedula: string;
  titulo: string;
  institucion: string;
  anioRegistro: number;
  tipo: string;
}

Deno.serve(async (req) => {
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
    const { cedula } = await req.json();

    if (!cedula) {
      throw new Error("Cédula es requerida");
    }

    const cedulaRegex = /^\d{7,8}$/;
    if (!cedulaRegex.test(cedula)) {
      throw new Error("Formato de cédula inválido. Debe contener 7-8 dígitos");
    }

    // Query the free SEP Solr endpoint
    const solrUrl = `https://search.sep.gob.mx/solr/cedulasCore/select?fl=*,score&q=${encodeURIComponent(cedula)}&start=0&rows=10&wt=json`;

    console.log("Querying SEP Solr:", solrUrl);

    let apiResponse: Response;
    try {
      apiResponse = await fetch(solrUrl, {
        method: "GET",
        headers: { "Accept": "application/json" },
      });
    } catch (fetchError) {
      console.error("SEP endpoint unreachable:", fetchError);
      return new Response(
        JSON.stringify({
          success: false,
          verified: false,
          error: "El servicio de la SEP no está disponible. Puedes verificar manualmente en cedulaprofesional.sep.gob.mx o esperar a que un administrador apruebe tu cédula.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiText = await apiResponse.text();
    console.log("SEP Solr status:", apiResponse.status, "body length:", apiText.length);

    let solrData: { response?: { numFound?: number; docs?: SolrDoc[] } };
    try {
      solrData = JSON.parse(apiText);
    } catch {
      console.error("Failed to parse SEP Solr response");
      return new Response(
        JSON.stringify({
          success: false,
          verified: false,
          error: "Error al consultar el servicio de la SEP. Puedes verificar manualmente en cedulaprofesional.sep.gob.mx o esperar aprobación del administrador.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!apiResponse.ok || !solrData.response?.docs?.length) {
      return new Response(
        JSON.stringify({
          success: false,
          verified: false,
          error: "Cédula no encontrada en el registro de la SEP. Verifica el número o espera aprobación del administrador.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find exact match by numCedula
    const matchedDoc = solrData.response.docs.find(
      (doc) => doc.numCedula === cedula
    );

    if (!matchedDoc) {
      return new Response(
        JSON.stringify({
          success: false,
          verified: false,
          error: "No se encontró una cédula con ese número exacto en el registro de la SEP.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check if cedula is already claimed by someone else
    const { data: existingClaim } = await supabaseAdmin
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
      nombre: matchedDoc.nombre,
      paterno: matchedDoc.paterno,
      materno: matchedDoc.materno,
      titulo: matchedDoc.titulo,
      institucion: matchedDoc.institucion,
      anio_registro: matchedDoc.anioRegistro,
      is_verified: true,
      verified_at: new Date().toISOString(),
      raw_response: matchedDoc as any,
    };

    const { data: existingVerification } = await supabaseAdmin
      .from("cedula_verifications")
      .select("id")
      .eq("user_id", userId)
      .eq("cedula_number", cedula)
      .maybeSingle();

    let verificationId: string;

    if (existingVerification) {
      const { data, error } = await supabaseAdmin
        .from("cedula_verifications")
        .update(verificationData)
        .eq("id", existingVerification.id)
        .select()
        .single();

      if (error) throw error;
      verificationId = data.id;
    } else {
      const { data, error } = await supabaseAdmin
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
          nombre: matchedDoc.nombre,
          paterno: matchedDoc.paterno,
          materno: matchedDoc.materno,
          titulo: matchedDoc.titulo,
          institucion: matchedDoc.institucion,
          anioRegistro: matchedDoc.anioRegistro,
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
