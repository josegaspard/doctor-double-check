// Sends an email to the patient when a doctor confirms their appointment request,
// plus an in-app notification.
// SECURITY 2026-05-17: requireUserJWT + ownership check (caller must be the
// appointment's doctor). Antes: cualquiera con un appointmentId podía spamear
// emails "✅ Cita confirmada con el Dr. X" + notificación in-app a pacientes.
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireUserJWT, AuthError, corsHeadersFor } from "../_shared/auth-guards.ts";
import { renderEmail, detailTable } from "../_shared/email-template.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "Medical Masters <noreply@medical-masters.com>";
const APP_URL = "https://medical-masters.com";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-MX", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

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
    const { appointmentId } = await req.json();
    if (!appointmentId) {
      return new Response(JSON.stringify({ error: "Missing appointmentId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: appt } = await admin
      .from("appointments")
      .select("id, patient_id, doctor_id, scheduled_at, reason, status")
      .eq("id", appointmentId)
      .single();

    if (!appt) {
      return new Response(JSON.stringify({ error: "appointment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Solo el doctor de la cita puede dispararla.
    if (appt.doctor_id !== callerId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: patient }, { data: doctor }] = await Promise.all([
      admin.from("profiles").select("email, name").eq("id", appt.patient_id).single(),
      admin.from("profiles").select("name").eq("id", appt.doctor_id).single(),
    ]);

    const when = formatDate(appt.scheduled_at);
    const doctorName = doctor?.name || "tu médico";

    if (patient?.email) {
      const rows: Array<[string, string]> = [
        ["Médico", `Dr. ${doctorName}`],
        ["Fecha y hora", when],
      ];
      if (appt.reason) rows.push(["Motivo", appt.reason]);

      const html = renderEmail({
        preheader: `Tu cita con el Dr. ${doctorName} está confirmada — ${when}`,
        accent: "success",
        eyebrow: "Cita confirmada",
        title: "Tu cita está confirmada",
        subtitle: `El Dr. ${doctorName} confirmó tu cita médica.`,
        greeting: `Hola, ${patient.name || ""}`,
        bodyHtml: `
          ${detailTable(rows)}
          <p style="margin:8px 0 0;color:#475569;font-size:14px;">Te enviaremos un recordatorio antes de la consulta. Si necesitas cancelar, hazlo desde Mis Citas con al menos 2 horas de anticipación.</p>
        `,
        ctaText: "Ver mis citas",
        ctaUrl: `${APP_URL}/my-appointments`,
        appUrl: APP_URL,
      });

      await resend.emails.send({
        from: FROM_EMAIL,
        to: [patient.email],
        subject: `Cita confirmada con el Dr. ${doctorName}`,
        html,
      });
    }

    await admin.from("notifications").insert({
      user_id: appt.patient_id,
      type: "appointment_confirmed" as any,
      title: "✅ Cita confirmada",
      message: `El Dr. ${doctorName} confirmó tu cita para ${when}`,
      data: { appointmentId: appt.id, doctorId: appt.doctor_id, scheduledAt: appt.scheduled_at },
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-appointment-confirmation error", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
