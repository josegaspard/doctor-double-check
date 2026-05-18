// Notify the patient by email + push when they missed a video call from their doctor.
// SECURITY 2026-05-17: requireUserJWT + ownership check (caller must be the
// consultation's doctor). Antes: cualquiera con un consultationId podía spamear
// emails "📞 Llamada perdida del Dr. X" + notificación in-app a pacientes.
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireUserJWT, AuthError, corsHeadersFor } from "../_shared/auth-guards.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "Medical Masters <noreply@medical-masters.com>";
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

    const subject = `📞 Llamada perdida del Dr. ${doctor?.name || "tu médico"}`;
    const html = `
      <!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/></head>
      <body style="margin:0;background:#fff;font-family:Inter,Arial,sans-serif;">
        <div style="max-width:600px;margin:20px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);">
          <div style="background:linear-gradient(135deg,#163a83,#00768b);padding:32px 24px;text-align:center;">
            <img src="${APP_URL}/email-logo-white.png" width="180" alt="Medical Masters" style="margin:0 auto;" />
          </div>
          <div style="padding:32px 24px;color:#1e293b;">
            <h1 style="margin:0 0 16px;font-size:22px;color:#163a83;">📞 Tuviste una llamada perdida</h1>
            <p style="font-size:16px;line-height:1.6;">Hola ${patient.name || ""},</p>
            <p style="font-size:16px;line-height:1.6;">
              El <strong>Dr. ${doctor?.name || "tu médico"}</strong> intentó iniciar una videoconsulta contigo pero no respondiste a tiempo.
            </p>
            <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;margin:16px 0;">
              <p style="margin:0;font-size:14px;color:#0c4a6e;">
                Puedes responder por chat ahora mismo o esperar a que el médico te contacte de nuevo.
              </p>
            </div>
            <div style="text-align:center;margin-top:24px;">
              <a href="${APP_URL}/chat" style="display:inline-block;background:#163a83;color:#fff;padding:14px 28px;border-radius:12px;font-weight:600;text-decoration:none;">Abrir chat con el médico</a>
            </div>
            <hr style="margin:32px 0;border:0;border-top:1px solid #e2e8f0;" />
            <p style="color:#94a3b8;font-size:12px;text-align:center;margin:0;">
              ${new Date().toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
        </div>
      </body></html>
    `;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: [patient.email],
      subject,
      html,
    });

    // Also drop an in-app notification so the bell catches it
    await admin.from("notifications").insert({
      user_id: consultation.patient_id,
      type: "missed_call" as any,
      title: "📞 Llamada perdida",
      message: `El Dr. ${doctor?.name || "tu médico"} intentó llamarte`,
      data: { consultationId, doctorId: consultation.doctor_id },
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
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

