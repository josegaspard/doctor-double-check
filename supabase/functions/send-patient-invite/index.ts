// send-patient-invite — correo de invitación de un médico a una persona de su
// lista («Importar datos» / «Añadir paciente» en Mis pacientes, 13-sep-2026).
//
// Reglas:
//   · Autenticada (JWT de usuario). Solo el médico APROBADO dueño de la
//     invitación puede enviarla. Nunca se envía a una dirección que no sea la
//     guardada en la invitación (no es un relay abierto).
//   · Solo invitaciones `pending` o `sent` y con correo.
//   · Freno anti-spam: una vez por invitación cada hora y máx. 100 envíos por
//     médico en 24 h.
//   · El correo lleva el nombre del médico y el enlace personal. NO lleva la
//     nota del médico (puede tener datos clínicos).
//   · Si la tabla todavía no existe (migración 20260913d sin aplicar) responde
//     409 `pending_activation` sin romper nada.
//   · Al enviar marca la invitación como `sent` (sent_at = now()).
//
// Body: { "invite_id": "<uuid>" }
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

import { requireUserJWT, AuthError, corsHeaders } from "../_shared/auth-guards.ts";
import { renderEmail, infoCard } from "../_shared/email-template.ts";

const APP_URL = Deno.env.get("APP_URL") ?? "https://medical-masters.com";
const RESEND_COOLDOWN_MS = 60 * 60 * 1000;
const DAILY_LIMIT = 100;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const isMissingTable = (err: any) => {
  if (!err) return false;
  const code = String(err.code ?? "");
  if (["42P01", "PGRST205", "PGRST202", "42883"].includes(code)) return true;
  const msg = `${err.message ?? ""} ${err.details ?? ""}`.toLowerCase();
  return /does not exist|schema cache|could not find the table/.test(msg);
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  let user;
  try {
    user = await requireUserJWT(req);
  } catch (e) {
    if (e instanceof AuthError) return e.toResponse();
    return json(500, { error: "auth_failed" });
  }

  let inviteId = "";
  try {
    const body = await req.json();
    inviteId = String(body?.invite_id ?? "").trim();
  } catch {
    return json(400, { error: "invalid_body" });
  }
  if (!UUID_RE.test(inviteId)) return json(400, { error: "invalid_invite_id" });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    // Médico aprobado.
    const { data: doctor, error: docErr } = await admin
      .from("doctor_profiles")
      .select("status, specialty")
      .eq("user_id", user.id)
      .maybeSingle();
    if (docErr) throw docErr;
    if (!doctor || doctor.status !== "approved") return json(403, { error: "not_approved_doctor" });

    // La invitación tiene que ser SUYA.
    const { data: invite, error: invErr } = await admin
      .from("doctor_patient_invites")
      .select("id, doctor_id, full_name, email, token, status, sent_at")
      .eq("id", inviteId)
      .eq("doctor_id", user.id)
      .maybeSingle();
    if (invErr) {
      if (isMissingTable(invErr)) return json(409, { error: "pending_activation" });
      throw invErr;
    }
    if (!invite) return json(404, { error: "invite_not_found" });
    if (invite.status !== "pending" && invite.status !== "sent") {
      return json(409, { error: "invite_not_sendable", status: invite.status });
    }
    if (!invite.email) return json(400, { error: "no_email" });

    if (invite.sent_at && Date.now() - new Date(invite.sent_at).getTime() < RESEND_COOLDOWN_MS) {
      return json(429, { error: "recently_sent" });
    }
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: sentToday, error: cntErr } = await admin
      .from("doctor_patient_invites")
      .select("id", { head: true, count: "exact" })
      .eq("doctor_id", user.id)
      .gte("sent_at", since);
    if (cntErr) throw cntErr;
    if ((sentToday ?? 0) >= DAILY_LIMIT) return json(429, { error: "daily_limit" });

    const { data: profile } = await admin
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .maybeSingle();
    const doctorName = (profile?.name || "").trim() || "Tu médico";
    const specialty = (doctor.specialty || "").trim();
    const patientName = String(invite.full_name || "").trim();
    const link = `${APP_URL}/app?invitacion=${encodeURIComponent(invite.token)}`;

    const html = renderEmail({
      preheader: `${doctorName} te invita a Medical Masters.`,
      accent: "info",
      eyebrow: "Invitación de tu médico",
      title: `${doctorName} te invita a Medical Masters`,
      subtitle: specialty || undefined,
      greeting: patientName ? `Hola, ${patientName}` : "Hola",
      bodyHtml: `
        <p style="margin:0 0 12px;"><strong>${escapeHtml(doctorName)}</strong> te invitó a unirte a Medical Masters, la plataforma donde atiende a sus pacientes.</p>
        ${infoCard({
          title: "Qué pasa al aceptar",
          accent: "info",
          html: `
            <ul style="margin:6px 0 0;padding-left:22px;">
              <li>Creas tu cuenta de paciente (o entras con la que ya tienes).</li>
              <li>Apareces en la lista de pacientes de ${escapeHtml(doctorName)} y sigues su perfil sin costo.</li>
              <li>Tu correo, tu teléfono y tu expediente siguen privados hasta que tú decidas compartirlos.</li>
            </ul>`,
        })}
        <p style="margin:8px 0 0;color:#475569;font-size:14px;">Si no conoces a ${escapeHtml(doctorName)} o no esperabas este correo, ignóralo: no se crea ninguna cuenta sin tu permiso.</p>
      `,
      ctaText: "Aceptar invitación",
      ctaUrl: link,
      secondaryNote: `Este enlace es personal. Si el botón no funciona, copia esta dirección en tu navegador:<br/><span style="word-break:break-all;">${escapeHtml(link)}</span>`,
      appUrl: APP_URL,
    });

    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const { error: sendErr } = await resend.emails.send({
      from: Deno.env.get("FROM_EMAIL") ?? "Medical Masters <no-reply@notify.medical-masters.com>",
      to: [invite.email],
      subject: `${doctorName} te invita a Medical Masters`,
      html,
    });
    if (sendErr) throw sendErr;

    const { error: updErr } = await admin
      .from("doctor_patient_invites")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", invite.id)
      .eq("doctor_id", user.id)
      .in("status", ["pending", "sent"]);
    if (updErr) console.error("[send-patient-invite] no se pudo marcar como enviada:", updErr.message);

    return json(200, { success: true, status: "sent" });
  } catch (error: any) {
    console.error("[send-patient-invite] error:", error?.message ?? error);
    return json(500, { success: false, error: "send_failed" });
  }
};

Deno.serve(handler);
