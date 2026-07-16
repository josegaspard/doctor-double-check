// Self-service account deletion endpoint (required by Apple App Store + Google Play).
// Authenticated user can delete THEIR OWN account. Cascades through public schema
// (FKs are ON DELETE CASCADE on user_id where appropriate) and finally removes the
// auth.users row.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller identity from JWT
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse confirmation (require explicit confirmation phrase to prevent accidents)
    let confirmation = "";
    try {
      const body = await req.json();
      confirmation = body?.confirmation ?? "";
    } catch (_) {
      // empty body is treated as not confirmed
    }
    if (confirmation !== "ELIMINAR" && confirmation !== "DELETE") {
      return new Response(JSON.stringify({ error: "confirmation_required", expected: "ELIMINAR" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Anonymize / wipe profile data before deleting auth row. Tables with ON DELETE CASCADE
    // on user_id will be cleaned automatically when auth.users row is removed.
    // For tables that DON'T cascade (most public tables ref user_id without FK to auth.users
    // because of RLS patterns), we explicitly clear data the user wants gone.
    const uid = user.id;

    // Best-effort cleanup. We swallow errors per-table so the auth deletion still happens.
    const tables = [
      "doctor_profiles",
      "resident_profiles",
      "doctor_content",
      "doctor_subscribers",
      "consultations",
      "chat_messages",
      "medical_records",
      "wallet_transactions",
      "wallets",
      "marketplace_orders",
      "hospital_reviews",
      "hospital_doctors",
      "onboarding_progress",
      // Datos personales/sensibles que NO tienen FK ON DELETE CASCADE a auth.users
      // (antes quedaban huérfanos → incumplimiento LFPDPPP/ARCO al ejercer supresión).
      "identity_verifications",
      "cedula_verifications",
      "phone_verifications",
      "notifications",
      "user_roles",
      "profiles",
    ];
    for (const table of tables) {
      try {
        // user_id is the canonical FK; profiles uses id; user_roles uses user_id
        if (table === "profiles") {
          await admin.from(table).delete().eq("id", uid);
        } else {
          await admin.from(table).delete().eq("user_id", uid);
        }
      } catch (e) {
        console.warn(`cleanup ${table} failed`, e);
      }
    }

    // Tablas clínicas que referencian al usuario por `patient_id` (NO `user_id`).
    // patient_clinical_history no tiene FK con CASCADE → hay que borrarla explícita
    // por su columna real, o el expediente quedaba intacto tras "eliminar cuenta".
    const patientIdTables = ["patient_clinical_history"];
    for (const table of patientIdTables) {
      try {
        await admin.from(table).delete().eq("patient_id", uid);
      } catch (e) {
        console.warn(`cleanup ${table} (patient_id) failed`, e);
      }
    }

    // Purga de Storage: los buckets PRIVADOS guardan los archivos del usuario bajo
    // la carpeta `${uid}/...`. Sin esto, estudios médicos, historia clínica, cédulas
    // e identificaciones escaneadas quedaban en Storage para siempre tras la supresión
    // (PHI/identidad sensible → riesgo de multa LFPDPPP). Best-effort: no bloquea el borrado.
    const privateBuckets = ["vault-files", "medical-history", "documents", "doctor-credentials", "doctor-content"];
    for (const bucket of privateBuckets) {
      try {
        const toRemove: string[] = [];
        // Raíz del usuario
        const { data: rootList } = await admin.storage.from(bucket).list(uid, { limit: 1000 });
        for (const obj of rootList ?? []) {
          if (obj.id) toRemove.push(`${uid}/${obj.name}`);
        }
        // Subcarpeta history/ (medical-history usa `${uid}/history/...`)
        const { data: subList } = await admin.storage.from(bucket).list(`${uid}/history`, { limit: 1000 });
        for (const obj of subList ?? []) {
          if (obj.id) toRemove.push(`${uid}/history/${obj.name}`);
        }
        if (toRemove.length > 0) {
          await admin.storage.from(bucket).remove(toRemove);
        }
      } catch (e) {
        console.warn(`storage purge ${bucket} failed`, e);
      }
    }

    // Finally delete the auth.users row (revokes all sessions)
    const { error: delErr } = await admin.auth.admin.deleteUser(uid);
    if (delErr) {
      console.error("auth.admin.deleteUser failed", delErr);
      return new Response(JSON.stringify({ error: delErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, deleted: uid }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("delete-account error", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
