import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SPECIALTIES = [
  "Alergología e Inmunología", "Algología", "Anestesiología", "Cardiología Clínica",
  "Cardiología Intervencionista", "Cirugía Bariátrica", "Cirugía Cardíaca",
  "Cirugía General", "Cirugía Oncológica", "Cirugía Pediátrica",
  "Cirugía Plástica, Estética y Reconstructiva", "Coloproctología",
  "Dermatología", "Endocrinología", "Gastroenterología", "Geriatría",
  "Ginecología y Obstetricia", "Hematología", "Infectología",
  "Medicina Crítica", "Medicina General", "Medicina Interna",
  "Nefrología", "Neonatología", "Neumología", "Neurocirugía", "Neurología",
  "Nutrición Clínica", "Oftalmología", "Oncología Médica",
  "Ortopedia y Traumatología", "Otorrinolaringología y Cirugía de Cabeza y Cuello",
  "Pediatría", "Psiquiatría Adultos", "Radiología e Imagen",
  "Reumatología", "Urgencias", "Urología",
];

const INSTITUTIONS = [
  "Hospital General de México",
  "Instituto Nacional de Cardiología",
  "Hospital Ángeles Pedregal",
  "Centro Médico ABC",
  "Hospital Español",
  "Instituto Nacional de Ciencias Médicas",
  "Hospital Médica Sur",
  "Hospital San Ángel Inn",
  "Instituto Nacional de Neurología",
  "Hospital La Raza IMSS",
];

const PATIENT_NAMES = [
  "María García López",
  "Carlos Rodríguez Hernández",
  "Ana Martínez Sánchez",
  "Pedro Fernández Torres",
  "Laura González Ramírez",
  "Miguel Pérez Flores",
  "Carmen Díaz Morales",
  "José López Castro",
  "Isabel Sánchez Ruiz",
  "Francisco Moreno Ortiz",
  "Elena Ruiz Jiménez",
  "Antonio Castro Gil",
  "Rosa Jiménez Vargas",
  "Manuel Vargas Luna",
  "Patricia Luna Mendoza",
  "David Mendoza Reyes",
  "Lucía Reyes Herrera",
  "Jorge Herrera Paz",
  "Sofía Paz Navarro",
  "Alejandro Navarro Rojas",
];

const DOCTOR_NAMES = [
  "Dr. Ricardo Montoya Salazar",
  "Dra. Gabriela Vega Contreras",
  "Dr. Fernando Ibarra Medina",
  "Dra. Valentina Cruz Delgado",
  "Dr. Sebastián Aguirre Campos",
  "Dra. Camila Ríos Valencia",
  "Dr. Andrés Núñez Paredes",
  "Dra. Mariana Soto Guerrero",
  "Dr. Nicolás Espinoza Ramos",
  "Dra. Daniela Fuentes León",
  "Dr. Emilio Torres Acosta",
  "Dra. Carolina Mejía Bustos",
  "Dr. Roberto Silva Ponce",
  "Dra. Paula Guzmán Mora",
  "Dr. Diego Carrillo Vera",
  "Dra. Natalia Peña Orozco",
  "Dr. Mauricio Lara Figueroa",
  "Dra. Andrea Molina Duarte",
  "Dr. Víctor Romero Cordero",
  "Dra. Fernanda Ortega Bravo",
];

const RESIDENT_NAMES = [
  "Res. Alejandra Mendez Torres",
  "Res. Daniel Ochoa Ramírez",
  "Res. Mónica Salinas Cruz",
  "Res. Eduardo Ríos Vega",
  "Res. Valeria Paredes León",
  "Res. Rodrigo Fuentes Mora",
  "Res. Isabella Moreno Díaz",
  "Res. Javier Castro Núñez",
  "Res. Andrea López Herrera",
  "Res. Francisco Guzmán Ortiz",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const createdUsers: { type: string; email: string; name: string }[] = [];
    const errors: string[] = [];

    // Get existing users once to avoid repeated API calls
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingEmails = new Set(existingUsers?.users?.map(u => u.email) || []);

    // Create 20 verified patients
    for (let i = 0; i < 20; i++) {
      const email = `paciente${i + 1}@medicalmasters.test`;
      const name = PATIENT_NAMES[i];
      const password = "Demo1234!";

      try {
        if (existingEmails.has(email)) {
          console.log(`Patient ${email} already exists, skipping`);
          continue;
        }

        const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { name, role: "patient" },
        });

        if (authError) {
          errors.push(`Patient ${email}: ${authError.message}`);
          continue;
        }

        const userId = authData.user!.id;

        await adminClient.from("profiles").upsert({
          id: userId,
          email,
          name,
          is_identity_verified: true,
          onboarding_completed: true,
        });

        await adminClient.from("user_roles").upsert({
          user_id: userId,
          role: "patient",
        });

        await adminClient.from("wallets").upsert({
          user_id: userId,
          balance: 500,
        });

        createdUsers.push({ type: "patient", email, name });
      } catch (e: any) {
        errors.push(`Patient ${email}: ${e.message}`);
      }
    }

    // Create 20 approved doctors
    for (let i = 0; i < 20; i++) {
      const email = `doctor${i + 1}@medicalmasters.test`;
      const name = DOCTOR_NAMES[i];
      const specialty = SPECIALTIES[i % SPECIALTIES.length];
      const password = "Demo1234!";

      try {
        if (existingEmails.has(email)) {
          console.log(`Doctor ${email} already exists, skipping`);
          continue;
        }

        const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { name, role: "doctor", specialty },
        });

        if (authError) {
          errors.push(`Doctor ${email}: ${authError.message}`);
          continue;
        }

        const userId = authData.user!.id;

        await adminClient.from("profiles").upsert({
          id: userId,
          email,
          name,
          is_identity_verified: true,
          onboarding_completed: true,
        });

        await adminClient.from("user_roles").upsert({
          user_id: userId,
          role: "doctor",
        });

        // Create wallet for doctor (for pending_earnings)
        await adminClient.from("wallets").upsert({
          user_id: userId,
          balance: 0,
        });

        await adminClient.from("doctor_profiles").upsert({
          user_id: userId,
          specialty,
          license: `${1000000 + i}`,
          cedula_profesional: `${7000000 + i}`,
          status: "approved",
          rating: 0,
          bio: `Especialista en ${specialty} con amplia experiencia clínica.`,
          location: "Ciudad de México",
          available_for_double_check: true,
          available_for_clinical_sessions: true,
        });

        createdUsers.push({ type: "doctor", email, name });
      } catch (e: any) {
        errors.push(`Doctor ${email}: ${e.message}`);
      }
    }

    // Create 10 approved residents
    for (let i = 0; i < 10; i++) {
      const email = `residente${i + 1}@medicalmasters.test`;
      const name = RESIDENT_NAMES[i];
      const specialty = SPECIALTIES[i % SPECIALTIES.length];
      const institution = INSTITUTIONS[i % INSTITUTIONS.length];
      const year = (i % 4) + 1; // Year 1-4
      const password = "Demo1234!";

      try {
        if (existingEmails.has(email)) {
          console.log(`Resident ${email} already exists, skipping`);
          continue;
        }

        const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { name, role: "resident", specialty, institution },
        });

        if (authError) {
          errors.push(`Resident ${email}: ${authError.message}`);
          continue;
        }

        const userId = authData.user!.id;

        await adminClient.from("profiles").upsert({
          id: userId,
          email,
          name,
          is_identity_verified: true,
          onboarding_completed: true,
        });

        await adminClient.from("user_roles").upsert({
          user_id: userId,
          role: "resident",
        });

        // Create wallet for resident (50% discount on purchases)
        await adminClient.from("wallets").upsert({
          user_id: userId,
          balance: 250,
        });

        // First insert, then update status (upsert doesn't override default status)
        await adminClient.from("resident_profiles").upsert({
          user_id: userId,
          specialty,
          institution,
          year,
          titulo_medicina: `TM-${8000000 + i}`,
          cedula_profesional: `CP-${9000000 + i}`,
        });
        
        // Force update status to approved
        await adminClient.from("resident_profiles")
          .update({ status: "approved" })
          .eq("user_id", userId);

        createdUsers.push({ type: "resident", email, name });
      } catch (e: any) {
        errors.push(`Resident ${email}: ${e.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        created: createdUsers.length,
        users: createdUsers,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Seed error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
