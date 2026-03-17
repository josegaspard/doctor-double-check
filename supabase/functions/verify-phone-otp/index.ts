import { createClient } from "npm:@supabase/supabase-js@2";

const SMS_API_KEY = Deno.env.get("SMS_API_KEY");
const SMS_API_SECRET = Deno.env.get("SMS_API_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-PHONE] ${step}${detailsStr}`);
};

async function sendSmsVonage(to: string, message: string): Promise<boolean> {
  if (!SMS_API_KEY || !SMS_API_SECRET) {
    logStep("SMS skipped: missing credentials");
    return false;
  }
  try {
    const resp = await fetch("https://rest.nexmo.com/sms/json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: SMS_API_KEY,
        api_secret: SMS_API_SECRET,
        to: to.replace(/\D/g, ''),
        from: "MedMasters",
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

    const userId = userData.user.id;
    const { phone, action, otp_code } = await req.json();

    if (!phone) throw new Error("phone is required");
    if (!action || !["send", "verify"].includes(action)) throw new Error("action must be 'send' or 'verify'");

    // Normalize phone
    const normalizedPhone = phone.replace(/\D/g, '');
    if (normalizedPhone.length < 10) throw new Error("Invalid phone number");

    logStep("Request", { userId, action, phone: `***${normalizedPhone.slice(-4)}` });

    if (action === "send") {
      // Generate OTP
      const otpCode = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min

      // Save to phone_verifications
      const { error: insertError } = await supabaseAdmin
        .from("phone_verifications")
        .insert({
          user_id: userId,
          phone: normalizedPhone,
          otp_code: otpCode,
          expires_at: expiresAt,
        });

      if (insertError) throw new Error("Failed to create verification record");
      logStep("OTP created", { expiresAt });

      // Send SMS
      const message = `Medical Masters - Tu código de verificación es: ${otpCode}. Expira en 5 minutos.`;
      const smsSent = await sendSmsVonage(normalizedPhone, message);

      if (!smsSent) {
        logStep("SMS failed to send");
        // Still return success since OTP was created - user can check in-app notification
      }

      // Also send in-app notification
      await supabaseAdmin.from("notifications").insert({
        user_id: userId,
        type: "system",
        title: "Verificación de teléfono",
        message: `Tu código de verificación es: ${otpCode}. Expira en 5 minutos.`,
        data: { otp_code: otpCode },
      });

      return new Response(
        JSON.stringify({ success: true, smsSent }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (action === "verify") {
      if (!otp_code) throw new Error("otp_code is required for verification");

      const { data: verification, error: verifyError } = await supabaseAdmin
        .from("phone_verifications")
        .select("*")
        .eq("user_id", userId)
        .eq("phone", normalizedPhone)
        .eq("otp_code", otp_code.trim())
        .is("verified_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (verifyError || !verification) {
        return new Response(
          JSON.stringify({ success: false, error: "Código inválido o expirado" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Mark as verified
      await supabaseAdmin
        .from("phone_verifications")
        .update({ verified_at: new Date().toISOString() })
        .eq("id", verification.id);

      // Update profile phone
      await supabaseAdmin
        .from("profiles")
        .update({ phone: normalizedPhone })
        .eq("id", userId);

      logStep("Phone verified and saved to profile");

      return new Response(
        JSON.stringify({ success: true, verified: true }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    throw new Error("Invalid action");
  } catch (error: any) {
    logStep("ERROR", { message: error.message || String(error) });
    return new Response(
      JSON.stringify({ success: false, error: error.message || String(error) }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
