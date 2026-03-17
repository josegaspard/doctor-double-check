import { createClient } from "npm:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SMS_API_KEY = Deno.env.get("SMS_API_KEY");
const SMS_API_SECRET = Deno.env.get("SMS_API_SECRET");
const SMS_PROVIDER = Deno.env.get("SMS_PROVIDER") || "vonage";
const SMS_FROM = Deno.env.get("SMS_FROM") || "MedMasters";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-OTP] ${step}${detailsStr}`);
};

async function sendSmsVonage(to: string, message: string): Promise<boolean> {
  try {
    const resp = await fetch("https://rest.nexmo.com/sms/json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: SMS_API_KEY,
        api_secret: SMS_API_SECRET,
        to: to.replace(/\D/g, ''),
        from: SMS_FROM,
        text: message,
      }),
    });
    const data = await resp.json();
    const success = data?.messages?.[0]?.status === "0";
    logStep("Vonage SMS result", { success, status: data?.messages?.[0]?.status });
    return success;
  } catch (e) {
    logStep("Vonage SMS error", { error: String(e) });
    return false;
  }
}

async function sendSmsTelnyx(to: string, message: string): Promise<boolean> {
  try {
    const resp = await fetch("https://api.telnyx.com/v2/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SMS_API_KEY}`,
      },
      body: JSON.stringify({
        from: SMS_FROM,
        to: to.replace(/\D/g, '').startsWith('+') ? to : `+${to.replace(/\D/g, '')}`,
        text: message,
      }),
    });
    const success = resp.ok;
    logStep("Telnyx SMS result", { success, status: resp.status });
    await resp.text();
    return success;
  } catch (e) {
    logStep("Telnyx SMS error", { error: String(e) });
    return false;
  }
}

async function sendSmsTextbelt(to: string, message: string): Promise<boolean> {
  try {
    const resp = await fetch("https://textbelt.com/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: to.replace(/\D/g, ''),
        message,
        key: SMS_API_KEY,
      }),
    });
    const data = await resp.json();
    const success = data?.success === true;
    logStep("Textbelt SMS result", { success, quotaRemaining: data?.quotaRemaining });
    return success;
  } catch (e) {
    logStep("Textbelt SMS error", { error: String(e) });
    return false;
  }
}

async function sendSms(phone: string, message: string): Promise<boolean> {
  if (!SMS_API_KEY) {
    logStep("SMS skipped: no SMS_API_KEY configured");
    return false;
  }
  if (SMS_PROVIDER === "textbelt") return sendSmsTextbelt(phone, message);
  if (SMS_PROVIDER === "telnyx") return sendSmsTelnyx(phone, message);
  return sendSmsVonage(phone, message);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

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

    let { patientId, deliveryMethod = "email" } = await req.json();
    if (!patientId) throw new Error("patientId is required");
    logStep("Request params", { patientId, deliveryMethod });

    // Verify caller is approved doctor
    const { data: doctorProfile, error: dpError } = await supabaseAdmin
      .from("doctor_profiles")
      .select("user_id, status")
      .eq("user_id", doctorId)
      .eq("status", "approved")
      .single();

    if (dpError || !doctorProfile) throw new Error("Only approved doctors can request OTP");
    logStep("Doctor verified");

    // Verify doctor-patient relationship
    const { data: relationCheck } = await supabaseAdmin
      .from("consultations")
      .select("id")
      .eq("doctor_id", doctorId)
      .eq("patient_id", patientId)
      .limit(1);

    if (!relationCheck || relationCheck.length === 0) {
      const { data: chatCheck } = await supabaseAdmin
        .from("chat_sessions")
        .select("id")
        .or(`and(participant1_id.eq.${doctorId},participant2_id.eq.${patientId}),and(participant1_id.eq.${patientId},participant2_id.eq.${doctorId})`)
        .limit(1);

      if (!chatCheck || chatCheck.length === 0) {
        throw new Error("No relationship found with this patient");
      }
    }
    logStep("Doctor-patient relationship verified");

    // ── SMS Rate limit: max 2 SMS per doctor per day ──
    let smsLimitReached = false;
    const wantsSms = deliveryMethod === "sms" || deliveryMethod === "both";

    if (wantsSms) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count } = await supabaseAdmin
        .from("expediente_otp")
        .select("*", { count: "exact", head: true })
        .eq("doctor_id", doctorId)
        .gte("created_at", today.toISOString());

      // We count all OTPs today as proxy for SMS sends (since we can't track delivery method in the table)
      // Max 2 SMS per day
      if ((count ?? 0) >= 2) {
        logStep("SMS rate limited", { otpCountToday: count });
        smsLimitReached = true;
        // Downgrade to email only
        deliveryMethod = "email";
      }
    }

    // Generate OTP
    const otpCode = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();

    const { error: otpError } = await supabaseAdmin
      .from("expediente_otp")
      .insert({ patient_id: patientId, doctor_id: doctorId, otp_code: otpCode, expires_at: expiresAt });

    if (otpError) throw new Error("Failed to create OTP record");
    logStep("OTP created", { expiresAt });

    // Get profiles
    const { data: patientProfile } = await supabaseAdmin
      .from("profiles")
      .select("email, name, phone")
      .eq("id", patientId)
      .single();

    const patientEmail = patientProfile?.email;
    const patientPhone = (patientProfile as any)?.phone;
    const patientName = patientProfile?.name || "Paciente";

    const { data: doctorProfileInfo } = await supabaseAdmin
      .from("profiles")
      .select("name")
      .eq("id", doctorId)
      .single();
    const doctorName = doctorProfileInfo?.name || "Tu médico";

    logStep("Profiles fetched", { patientName, doctorName, hasEmail: !!patientEmail, hasPhone: !!patientPhone });

    // Always send in-app notification
    await supabaseAdmin.from("notifications").insert({
      user_id: patientId,
      type: "system",
      title: "Código de acceso a tu expediente",
      message: `Tu médico ${doctorName} solicita acceso a tu expediente. Código: ${otpCode}. Expira en 2 minutos.`,
      data: { otp_code: otpCode, doctor_id: doctorId },
    });
    logStep("In-app notification sent");

    const shouldEmail = deliveryMethod === "email" || deliveryMethod === "both";
    const shouldSms = deliveryMethod === "sms" || deliveryMethod === "both";

    // Send email
    if (shouldEmail && patientEmail && RESEND_API_KEY) {
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Medical Masters</h1>
          </div>
          <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none;">
            <h2 style="color: #1e293b; margin-top: 0;">🔐 Código de acceso a tu expediente</h2>
            <p style="color: #475569;">Hola ${patientName},</p>
            <p style="color: #475569;"><strong>${doctorName}</strong> está solicitando acceso a tu expediente médico. Si estás de acuerdo, comparte el siguiente código:</p>
            <div style="background: #0ea5e9; color: white; font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 20px; border-radius: 8px; margin: 20px 0;">${otpCode}</div>
            <p style="color: #ef4444; font-weight: 600; text-align: center;">⏱️ Este código expira en 2 minutos</p>
            <p style="color: #475569; font-size: 14px;">Si no reconoces esta solicitud, ignora este correo. No compartas este código con nadie más.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
            <p style="color: #94a3b8; font-size: 14px; margin-bottom: 0;">Este es un correo automático, por favor no respondas a este mensaje.</p>
          </div>
        </body></html>`;

      const emailResp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: "Medical Masters <no-reply@cirugiaesteticauribe.com>",
          to: [patientEmail],
          subject: `🔐 Código de acceso a tu expediente médico: ${otpCode}`,
          html,
        }),
      });
      logStep(emailResp.ok ? "Email sent" : "Email failed", { status: emailResp.status });
      if (!emailResp.ok) await emailResp.text();
    } else if (shouldEmail) {
      logStep("Email skipped", { hasEmail: !!patientEmail, hasResendKey: !!RESEND_API_KEY });
    }

    // Send SMS
    let smsSent = false;
    if (shouldSms && patientPhone) {
      const smsMessage = `Medical Masters - Código OTP: ${otpCode}. Tu médico ${doctorName} solicita acceso a tu expediente. Expira en 2 min. No compartas con nadie más.`;
      smsSent = await sendSms(patientPhone, smsMessage);
    } else if (shouldSms) {
      logStep("SMS skipped", { hasPhone: !!patientPhone, hasSmsKey: !!SMS_API_KEY });
    }

    return new Response(
      JSON.stringify({ success: true, smsAvailable: !!SMS_API_KEY, smsSent, smsLimitReached }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    logStep("ERROR", { message: error.message || String(error) });
    return new Response(
      JSON.stringify({ success: false, error: error.message || String(error) }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
