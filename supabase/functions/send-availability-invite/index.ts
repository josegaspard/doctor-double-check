import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth-guards.ts";
import { renderEmail } from "../_shared/email-template.ts";

const APP_URL = "https://medical-masters.com";
const FROM = "Medical Masters <noreply@medical-masters.com>";

interface InvitePayload {
  availability_id: string;
  recipients: string[];
  action: "new" | "moved" | "cancelled";
  old_scheduled_at?: string;
}

const fmt = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("es-MX", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    const admin = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData.user) throw new Error("Authentication failed");

    const body = (await req.json()) as InvitePayload;
    const { availability_id, recipients, action, old_scheduled_at } = body;

    if (!availability_id) throw new Error("availability_id required");
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, skipped: "no recipients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: avail, error: aErr } = await admin
      .from("doctor_availability")
      .select("id, doctor_id, title, description, scheduled_at, duration_minutes, type, extra_invitees, status")
      .eq("id", availability_id)
      .eq("doctor_id", userData.user.id)
      .single();

    if (aErr || !avail) throw new Error("Availability not found or not yours");

    const { data: profile } = await admin
      .from("profiles_public")
      .select("name")
      .eq("id", userData.user.id)
      .single();
    const doctorName = profile?.name || "Tu doctor";

    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const allowed = new Set((avail.extra_invitees ?? []) as string[]);
    const targets = Array.from(new Set(recipients.map((e) => e.trim().toLowerCase())))
      .filter((e) => EMAIL_RE.test(e) && allowed.has(e));

    if (targets.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, skipped: "no allowed recipients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let subject = "";
    let eyebrow = "";
    let title = "";
    let accent: "info" | "warning" | "success" = "info";
    let bodyHtml = "";

    if (action === "new") {
      accent = "info";
      subject = `Nueva cita con ${doctorName}: ${avail.title}`;
      eyebrow = "NUEVA INVITACIÓN";
      title = avail.title;
      bodyHtml = `
        <p>${doctorName} te invita a la siguiente sesión:</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0;">
          <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Cuándo</td><td style="padding:6px 0;text-align:right;color:#0f172a;font-size:13px;font-weight:600;">${fmt(avail.scheduled_at)}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Duración</td><td style="padding:6px 0;text-align:right;color:#0f172a;font-size:13px;font-weight:600;">${avail.duration_minutes} min</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Tipo</td><td style="padding:6px 0;text-align:right;color:#0f172a;font-size:13px;font-weight:600;">${avail.type}</td></tr>
        </table>
        ${avail.description ? `<p style="color:#475569;font-size:14px;">${avail.description}</p>` : ""}
      `;
    } else if (action === "moved") {
      accent = "warning";
      subject = `Cambio de fecha: ${avail.title}`;
      eyebrow = "FECHA ACTUALIZADA";
      title = avail.title;
      bodyHtml = `
        <p>${doctorName} cambió la fecha de la sesión:</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0;">
          ${old_scheduled_at ? `<tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Antes</td><td style="padding:6px 0;text-align:right;color:#94a3b8;font-size:13px;text-decoration:line-through;">${fmt(old_scheduled_at)}</td></tr>` : ""}
          <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Ahora</td><td style="padding:6px 0;text-align:right;color:#0f172a;font-size:13px;font-weight:700;">${fmt(avail.scheduled_at)}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Duración</td><td style="padding:6px 0;text-align:right;color:#0f172a;font-size:13px;font-weight:600;">${avail.duration_minutes} min</td></tr>
        </table>
        ${avail.description ? `<p style="color:#475569;font-size:14px;">${avail.description}</p>` : ""}
      `;
    } else {
      accent = "warning";
      subject = `Cancelada: ${avail.title}`;
      eyebrow = "SESIÓN CANCELADA";
      title = avail.title;
      bodyHtml = `<p>${doctorName} canceló la sesión "${avail.title}" prevista para ${fmt(avail.scheduled_at)}.</p>`;
    }

    const html = renderEmail({
      preheader: subject,
      accent,
      eyebrow,
      title,
      bodyHtml,
      ctaText: "Abrir Medical Masters",
      ctaUrl: APP_URL,
      appUrl: APP_URL,
    });

    let sent = 0;
    const errors: string[] = [];
    for (const to of targets) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM,
          to,
          subject,
          html,
        }),
      });
      if (res.ok) {
        sent++;
      } else {
        const txt = await res.text();
        errors.push(`${to}: ${res.status} ${txt.slice(0, 120)}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent, total: targets.length, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[send-availability-invite] error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
