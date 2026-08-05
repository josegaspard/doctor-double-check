import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth-guards.ts";
import { renderEmail } from "../_shared/email-template.ts";

const APP_URL = "https://medical-masters.com";
const FROM = "Medical Masters <noreply@notify.medical-masters.com>";

interface MeetingInvitePayload {
  session_id: string;
  // Opcional: lista de user_ids a notificar. Si no se envía, se toman todos
  // los invitados (clinical_session_invitations) de la sesión.
  invitee_ids?: string[];
}

const fmt = (iso?: string | null) => {
  if (!iso) return "Por confirmar";
  const d = new Date(iso);
  return d.toLocaleString("es-MX", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    const { session_id, invitee_ids } = (await req.json()) as MeetingInvitePayload;
    if (!session_id) throw new Error("session_id required");

    // La reunión debe ser del organizador que llama (seguridad).
    const { data: session, error: sErr } = await admin
      .from("clinical_sessions")
      .select("id, organizer_id, title, description, specialty, scheduled_at")
      .eq("id", session_id)
      .eq("organizer_id", userData.user.id)
      .single();
    if (sErr || !session) throw new Error("Meeting not found or not yours");

    // Resolver los user_ids a notificar.
    let ids = invitee_ids ?? [];
    if (ids.length === 0) {
      const { data: invs } = await admin
        .from("clinical_session_invitations")
        .select("doctor_id")
        .eq("session_id", session_id);
      ids = (invs ?? []).map((i: { doctor_id: string }) => i.doctor_id).filter(Boolean);
    }
    ids = Array.from(new Set(ids));
    if (ids.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, skipped: "no invitees" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Emails de los invitados.
    const { data: profiles } = await admin
      .from("profiles_public")
      .select("id, name, email")
      .in("id", ids);

    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const targets = (profiles ?? [])
      .map((p: { email?: string | null }) => (p.email || "").trim().toLowerCase())
      .filter((e: string) => EMAIL_RE.test(e));

    if (targets.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, skipped: "no valid emails" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: organizer } = await admin
      .from("profiles_public").select("name").eq("id", userData.user.id).single();
    const organizerName = organizer?.name || "Un colega";

    const subject = `Invitación a reunión: ${session.title}`;
    const bodyHtml = `
      <p>${organizerName} te invitó a la siguiente reunión en Medical Masters:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0;">
        <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Reunión</td><td style="padding:6px 0;text-align:right;color:#0f172a;font-size:13px;font-weight:600;">${session.title}</td></tr>
        ${session.specialty ? `<tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Especialidad</td><td style="padding:6px 0;text-align:right;color:#0f172a;font-size:13px;font-weight:600;">${session.specialty}</td></tr>` : ""}
        <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Cuándo</td><td style="padding:6px 0;text-align:right;color:#0f172a;font-size:13px;font-weight:600;">${fmt(session.scheduled_at)}</td></tr>
      </table>
      ${session.description ? `<p style="color:#475569;font-size:14px;">${session.description}</p>` : ""}
    `;

    const html = renderEmail({
      preheader: subject,
      accent: "info",
      eyebrow: "NUEVA INVITACIÓN A REUNIÓN",
      title: session.title,
      bodyHtml,
      ctaText: "Ver en Medical Masters",
      ctaUrl: `${APP_URL}/meetings`,
      appUrl: APP_URL,
    });

    let sent = 0;
    const errors: string[] = [];
    for (const to of Array.from(new Set(targets))) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM, to, subject, html }),
      });
      if (res.ok) sent++;
      else errors.push(`${to}: ${res.status} ${(await res.text()).slice(0, 120)}`);
    }

    return new Response(JSON.stringify({ success: true, sent, total: targets.length, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[send-meeting-invite-email] error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
