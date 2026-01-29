import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SPECIALTIES = [
  "Cardiología",
  "Dermatología",
  "Endocrinología",
  "Gastroenterología",
  "Ginecología",
  "Medicina General",
  "Medicina Interna",
  "Neurología",
  "Oftalmología",
  "Oncología",
  "Ortopedia",
  "Pediatría",
  "Psiquiatría",
  "Urología",
  "Neumología",
  "Nefrología",
  "Reumatología",
  "Hematología",
  "Cirugía General",
  "Anestesiología",
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

serve(async (req) => {
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

    // Create 20 verified patients
    for (let i = 0; i < 20; i++) {
      const email = `paciente${i + 1}@medicalmasters.test`;
      const name = PATIENT_NAMES[i];
      const password = "Demo1234!";

      try {
        // Check if user already exists
        const { data: existingUser } = await adminClient.auth.admin.listUsers();
        const userExists = existingUser?.users?.find((u) => u.email === email);

        if (userExists) {
          console.log(`Patient ${email} already exists, skipping`);
          continue;
        }

        // Create auth user
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

        // Create profile
        await adminClient.from("profiles").upsert({
          id: userId,
          email,
          name,
          is_identity_verified: true,
          onboarding_completed: true,
        });

        // Create role
        await adminClient.from("user_roles").upsert({
          user_id: userId,
          role: "patient",
        });

        // Create wallet
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
        // Check if user already exists
        const { data: existingUser } = await adminClient.auth.admin.listUsers();
        const userExists = existingUser?.users?.find((u) => u.email === email);

        if (userExists) {
          console.log(`Doctor ${email} already exists, skipping`);
          continue;
        }

        // Create auth user
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

        // Create profile
        await adminClient.from("profiles").upsert({
          id: userId,
          email,
          name,
          is_identity_verified: true,
          onboarding_completed: true,
        });

        // Create role
        await adminClient.from("user_roles").upsert({
          user_id: userId,
          role: "doctor",
        });

        // Create doctor profile
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
