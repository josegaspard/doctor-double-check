import { createClient } from "npm:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-OTP-EMAIL] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // 1. Validate JWT and extract requesting user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) throw new Error("User not authenticated");

    const doctorId = userData.user.id;
    logStep("Doctor authenticated", { doctorId });

    // Parse request body - only need patientId now
    const { patientId } = await req.json();
    if (!patientId) throw new Error("patientId is required");

    // 2. Verify the caller is an approved doctor
    const { data: doctorProfile, error: dpError } = await supabaseAdmin
      .from("doctor_profiles")
      .select("user_id, status")
      .eq("user_id", doctorId)
      .eq("status", "approved")
      .single();

    if (dpError || !doctorProfile) {
      throw new Error("Only approved doctors can request OTP");
    }
    logStep("Doctor verified as approved");

    // 3. Verify doctor has vault access to this patient's files
    const { data: accessCheck } = await supabaseAdmin
      .from("vault_access")
      .select("id, file_id")
      .eq("doctor_id", doctorId)
      .limit(1);

    // Check if any of those files belong to the patient
    if (accessCheck && accessCheck.length > 0) {
      const fileIds = accessCheck.map((a: any) => a.file_id);
      const { data: fileCheck } = await supabaseAdmin
        .from("vault_files")
        .select("id")
        .in("id", fileIds)
        .eq("patient_id", patientId)
        .limit(1);

      if (!fileCheck || fileCheck.length === 0) {
        throw new Error("No vault access to this patient");
      }
    } else {
      throw new Error("No vault access found for doctor");
    }
    logStep("Vault access verified");

    // 4. Generate OTP (6 digits, 2 min expiry)
    const otpCode = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();

    const { error: otpError } = await supabaseAdmin
      .from("expediente_otp")
      .insert({
        patient_id: patientId,
        doctor_id: doctorId,
        otp_code: otpCode,
        expires_at: expiresAt,
      });

    if (otpError) {
      logStep("OTP insert failed", otpError);
      throw new Error("Failed to create OTP record");
    }
    logStep("OTP created", { otpCode: "***", expiresAt });

    // 5. Get patient info (using admin client, bypasses RLS)
    const { data: patientProfile } = await supabaseAdmin
      .from("profiles")
      .select("email, name")
      .eq("id", patientId)
      .single();

    const patientEmail = patientProfile?.email;
    const patientName = patientProfile?.name || "Paciente";

    // Get doctor name
    const { data: doctorProfileInfo } = await supabaseAdmin
      .from("profiles")
      .select("name")
      .eq("id", doctorId)
      .single();
    const doctorName = doctorProfileInfo?.name || "Tu médico";

    logStep("Profiles fetched", { patientName, doctorName, hasEmail: !!patientEmail });

    // 6. Insert in-app notification (using admin client, bypasses RLS)
    const { error: notifError } = await supabaseAdmin
      .from("notifications")
      .insert({
        user_id: patientId,
        type: "system",
        title: "🔐 Código de acceso a tu expediente",
        message: `Tu médico ${doctorName} solicita acceso a tu expediente. Código: ${otpCode}. Expira en 2 minutos.`,
        data: { otp_code: otpCode, doctor_id: doctorId },
      });

    if (notifError) {
      logStep("Notification insert failed (non-critical)", notifError);
    } else {
      logStep("In-app notification sent");
    }

    // 7. Send email with OTP
    if (patientEmail && RESEND_API_KEY) {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Medical Masters</h1>
            </div>
            <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none;">
              <h2 style="color: #1e293b; margin-top: 0;">🔐 Código de acceso a tu expediente</h2>
              <p style="color: #475569;">Hola ${patientName},</p>
              <p style="color: #475569;">
                <strong>${doctorName}</strong> está solicitando acceso a tu expediente médico. 
                Si estás de acuerdo, comparte el siguiente código:
              </p>
              <div style="background: #0ea5e9; color: white; font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 20px; border-radius: 8px; margin: 20px 0;">
                ${otpCode}
              </div>
              <p style="color: #ef4444; font-weight: 600; text-align: center;">
                ⏱️ Este código expira en 2 minutos
              </p>
              <p style="color: #475569; font-size: 14px;">
                Si no reconoces esta solicitud, ignora este correo. No compartas este código con nadie más.
              </p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
              <p style="color: #94a3b8; font-size: 14px; margin-bottom: 0;">
                Este es un correo automático, por favor no respondas a este mensaje.
              </p>
            </div>
          </body>
        </html>
      `;

      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Medical Masters <no-reply@cirugiaesteticauribe.com>",
          to: [patientEmail],
          subject: `🔐 Código de acceso a tu expediente médico: ${otpCode}`,
          html,
        }),
      });

      if (!emailResponse.ok) {
        const errorData = await emailResponse.text();
        logStep("Email send failed (non-critical)", { error: errorData });
      } else {
        logStep("Email sent successfully");
      }
    } else {
      logStep("Email skipped", { hasEmail: !!patientEmail, hasResendKey: !!RESEND_API_KEY });
    }

    // 8. Success response
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    const msg = error.message || String(error);
    logStep("ERROR", { message: msg });
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
