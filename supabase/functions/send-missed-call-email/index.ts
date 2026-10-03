// Notify the patient by email + push when they missed a video call from their doctor.
// SECURITY 2026-05-17: requireUserJWT + ownership check (caller must be the
// consultation's doctor). Antes: cualquiera con un consultationId podía spamear
// emails "📞 Llamada perdida del Dr. X" + notificación in-app a pacientes.
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireUserJWT, AuthError, corsHeadersFor } from "../_shared/auth-guards.ts";
import { renderEmail } from "../_shared/email-template.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "Medical Masters <noreply@notify.medical-masters.com>";
const APP_URL = "https://medical-masters.com";

Deno.serve(async (req: Request): Promise<Response> => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth: caller debe ser un usuario autenticado.
  let callerId: string;
  try {
    const user = await requireUserJWT(req);
    callerId = user.id;
  } catch (e) {
    if (e instanceof AuthError) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: e.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Auth check failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { consultationId } = await req.json();
    if (!consultationId) {
      return new Response(JSON.stringify({ error: "Missing consultationId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: consultation } = await admin
      .from("consultations")
      .select("patient_id, doctor_id")
      .eq("id", consultationId)
      .single();

    if (!consultation) {
      return new Response(JSON.stringify({ error: "consultation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Solo el doctor de la consulta puede disparar el "llamada perdida".
    if (consultation.doctor_id !== callerId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: patient }, { data: doctor }] = await Promise.all([
      admin.from("profiles").select("email, name").eq("id", consultation.patient_id).single(),
      admin.from("profiles").select("name").eq("id", consultation.doctor_id).single(),
    ]);

    if (!patient?.email) {
      return new Response(JSON.stringify({ skipped: "no patient email" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const docName = doctor?.name || "tu médico";
    const subject = `Llamada perdida del Dr. ${docName}`;
    const html = renderEmail({
      preheader: `El Dr. ${docName} intentó iniciar una videoconsulta contigo`,
      accent: "warning",
      eyebrow: "Llamada perdida",
      title: "Tuviste una llamada perdida",
      subtitle: `El Dr. ${docName} intentó iniciar una videoconsulta contigo pero no respondiste a tiempo.`,
      greeting: `Hola, ${patient.name || ""}`,
      bodyHtml: `
        <p style="margin:0 0 12px;">Puedes responder por chat ahora mismo o esperar a que el médico te contacte de nuevo.</p>
      `,
      ctaText: "Abrir chat con el médico",
      ctaUrl: `${APP_URL}/chat`,
      appUrl: APP_URL,
    });

    // Resend v2 no lanza excepción: devuelve { data, error }. Antes se ignoraba el
    // error y la función respondía ok aunque el correo no hubiera salido.
    const { error: emailError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [patient.email],
      subject,
      html,
    });
    if (emailError) console.error("send-missed-call-email resend error", emailError);

    // Also drop an in-app notification so the bell catches it.
    // 'missed_call' llega con la migración del enum notification_type; si aún no
    // existe, se reintenta con 'video_call' (el tipo existente más parecido).
    const notif = {
      user_id: consultation.patient_id,
      title: "Llamada perdida",
      message: `El Dr. ${doctor?.name || "tu médico"} intentó llamarte`,
      data: { consultationId, doctorId: consultation.doctor_id, kind: "missed_call" },
    };
    let { error: notifError } = await admin.from("notifications").insert({ ...notif, type: "missed_call" as any });
    if (notifError) {
      console.warn("send-missed-call-email: missed_call type rejected, retrying as video_call", notifError.message);
      ({ error: notifError } = await admin.from("notifications").insert({ ...notif, type: "video_call" }));
      if (notifError) console.error("send-missed-call-email notification insert failed", notifError.message);
    }

    return new Response(JSON.stringify({ ok: !emailError, email_sent: !emailError, notified: !notifError }), {
      status: emailError ? 502 : 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-missed-call-email error", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

