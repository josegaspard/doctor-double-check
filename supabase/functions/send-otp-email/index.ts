import { createClient } from "npm:@supabase/supabase-js@2";
import { renderEmail, infoCard } from "../_shared/email-template.ts";
import { maskName } from "../_shared/log-redact.ts";

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
    if (!authHeader) return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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

    logStep("Profiles fetched", { patientName: maskName(patientName), doctorName: maskName(doctorName), hasEmail: !!patientEmail, hasPhone: !!patientPhone });

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
      const html = renderEmail({
        preheader: `Código de acceso a tu expediente: ${otpCode} (expira en 2 minutos)`,
        accent: "warning",
        eyebrow: "Acceso a expediente",
        title: "Confirma el acceso a tu expediente",
        subtitle: `${doctorName} solicita ver tu expediente médico. Comparte el código solo si autorizas el acceso.`,
        greeting: `Hola, ${patientName}`,
        bodyHtml: `
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0;background:linear-gradient(135deg,#163a83 0%,#00768b 100%);border-radius:12px;">
            <tr><td align="center" style="padding:22px 16px;">
              <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,.78);font-weight:600;">Código</div>
              <div style="margin-top:6px;font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace;font-size:36px;font-weight:700;color:#ffffff;letter-spacing:0.4em;">${otpCode}</div>
              <div style="margin-top:8px;font-size:12px;color:rgba(255,255,255,.78);">Expira en 2 minutos</div>
            </td></tr>
          </table>
          ${infoCard({
            accent: "warning",
            html: `<p style="margin:0;">Si no reconoces esta solicitud, <strong>no compartas el código</strong> e ignora este correo.</p>`,
          })}
        `,
        showFooter: true,
      });

      const emailResp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: Deno.env.get("FROM_EMAIL") ?? "Medical Masters <no-reply@medical-masters.com>",
          to: [patientEmail],
          subject: `Código de acceso: ${otpCode}`,
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
