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

interface RapidApiResult {
  nombre?: string;
  paterno?: string;
  materno?: string;
  numCedula?: string;
  titulo?: string;
  institucion?: string;
  anioRegistro?: number;
}

async function tryRapidApi(cedula: string): Promise<SolrDoc | null> {
  const rapidApiKey = Deno.env.get("RAPIDAPI_KEY");
  if (!rapidApiKey) {
    console.log("No RAPIDAPI_KEY configured, skipping RapidAPI");
    return null;
  }

  try {
    const url = `https://cedulas-profesionales-sep.p.rapidapi.com/cedula/${encodeURIComponent(cedula)}`;
    console.log("Querying RapidAPI:", url);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-RapidAPI-Key": rapidApiKey,
        "X-RapidAPI-Host": "cedulas-profesionales-sep.p.rapidapi.com",
        "Accept": "application/json",
      },
    });

    const text = await response.text();
    console.log("RapidAPI status:", response.status, "body length:", text.length);

    if (!response.ok) {
      console.error("RapidAPI error:", text.substring(0, 200));
      return null;
    }

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      console.error("Failed to parse RapidAPI response");
      return null;
    }

    // RapidAPI may return an array or object
    const items = Array.isArray(data) ? data : data?.items || data?.results || (data?.numCedula ? [data] : []);

    if (!items.length) return null;

    // Find exact match
    const match = items.find((doc: any) => String(doc.numCedula) === String(cedula));
    if (!match) return null;

    return {
      nombre: match.nombre || "",
      paterno: match.paterno || "",
      materno: match.materno || "",
      numCedula: match.numCedula || cedula,
      titulo: match.titulo || "",
      institucion: match.institucion || "",
      anioRegistro: match.anioRegistro || 0,
      tipo: match.tipo || "",
    };
  } catch (err) {
    console.error("RapidAPI fetch error:", err);
    return null;
  }
}

async function trySepSolr(cedula: string): Promise<SolrDoc | null> {
  const solrUrl = `https://search.sep.gob.mx/solr/cedulasCore/select?fl=*,score&q=${encodeURIComponent(cedula)}&start=0&rows=10&wt=json`;
  console.log("Querying SEP Solr:", solrUrl);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(solrUrl, {
      method: "GET",
      headers: { "Accept": "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const text = await response.text();
    console.log("SEP Solr status:", response.status, "body length:", text.length);

    let solrData: { response?: { docs?: SolrDoc[] } };
    try {
      solrData = JSON.parse(text);
    } catch {
      return null;
    }

    if (!response.ok || !solrData.response?.docs?.length) return null;

    return solrData.response.docs.find((doc) => doc.numCedula === cedula) || null;
  } catch (err) {
    console.error("SEP Solr error:", err);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Usuario no autenticado");

    const userId = userData.user.id;
    const { cedula } = await req.json();

    if (!cedula) throw new Error("Cédula es requerida");

    const cedulaRegex = /^\d{7,8}$/;
    if (!cedulaRegex.test(cedula)) {
      throw new Error("Formato de cédula inválido. Debe contener 7-8 dígitos");
    }

    // Per-user rate limit: 10 cedula lookups / hour. Stops brute-force
    // enumeration of cedula numbers via this endpoint.
    {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      const { data: allowed, error: rlErr } = await admin.rpc("check_and_record_rate_limit", {
        p_bucket: "verify_cedula_sep",
        p_key: userId,
        p_max: 10,
        p_window_seconds: 3600,
      });
      if (rlErr) {
        console.warn("Rate-limit check error (allowing through):", rlErr.message);
      } else if (allowed === false) {
        return new Response(
          JSON.stringify({ success: false, error: "Demasiados intentos. Intenta de nuevo en una hora." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Try RapidAPI first (faster, more reliable), then SEP Solr as fallback
    let matchedDoc = await tryRapidApi(cedula);
    if (!matchedDoc) {
      console.log("RapidAPI failed or no match, trying SEP Solr...");
      matchedDoc = await trySepSolr(cedula);
    }

    if (!matchedDoc) {
      return new Response(
        JSON.stringify({
          success: false,
          verified: false,
          error: "Cédula no encontrada. Verifica el número o usa el enlace para verificar manualmente en cedulaprofesional.sep.gob.mx",
          manualUrl: "https://cedulaprofesional.sep.gob.mx",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize admin client
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
        manualUrl: "https://cedulaprofesional.sep.gob.mx",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
