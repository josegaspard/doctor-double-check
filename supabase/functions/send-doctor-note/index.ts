import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/auth-guards.ts";
import { renderEmail } from "../_shared/email-template.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface Body {
  to: string;
  subject?: string;
  body: string;
  noteId?: string;
  kind?: 'note' | 'invoice' | 'summary';
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Authenticate the caller — must be a logged-in doctor.
  const supa = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
  );
  const { data: { user }, error: authErr } = await supa.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: 'not authenticated' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: roles } = await supa.from('user_roles').select('role').eq('user_id', user.id);
  const isAdmin = (roles ?? []).some((r: any) => r.role === 'admin');
  const isDoctor = isAdmin || (roles ?? []).some((r: any) => r.role === 'doctor');
  if (!isDoctor) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { to, subject = 'Documento — Medical Masters', body, kind = 'note' }: Body = await req.json();
    if (!to || !body) {
      return new Response(JSON.stringify({ error: 'to and body required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ANTI-RELAY: el destinatario NO puede ser una dirección arbitraria. Debe ser
    //  (a) el propio email del emisor, o
    //  (b) un usuario REGISTRADO en la plataforma con quien el doctor tiene una
    //      relación real (consulta / cita / receta / chat). Admin puede enviar a
    //      cualquier usuario registrado sin exigir relación.
    // Sin esto, un doctor/admin autenticado podía usar el dominio como relay de spam.
    const toNorm = to.trim().toLowerCase();
    const callerEmail = (user.email ?? '').trim().toLowerCase();
    let allowed = !!callerEmail && toNorm === callerEmail;

    if (!allowed) {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      );
      const { data: recips } = await admin
        .from('profiles').select('id').ilike('email', toNorm).limit(1);
      const recipientId = recips?.[0]?.id as string | undefined;

      if (!recipientId) {
        return new Response(JSON.stringify({ error: 'recipient_not_allowed' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (isAdmin) {
        allowed = true; // admin → cualquier usuario registrado
      } else {
        // Doctor: exige relación documentada con el destinatario.
        const [cons, appt, presc, chat] = await Promise.all([
          admin.from('consultations').select('id', { head: true, count: 'exact' }).eq('doctor_id', user.id).eq('patient_id', recipientId),
          admin.from('appointments').select('id', { head: true, count: 'exact' }).eq('doctor_id', user.id).eq('patient_id', recipientId),
          admin.from('prescriptions').select('id', { head: true, count: 'exact' }).eq('doctor_id', user.id).eq('patient_id', recipientId),
          admin.from('chat_sessions').select('id', { head: true, count: 'exact' }).or(`and(participant1_id.eq.${user.id},participant2_id.eq.${recipientId}),and(participant2_id.eq.${user.id},participant1_id.eq.${recipientId})`),
        ]);
        allowed = (cons.count ?? 0) > 0 || (appt.count ?? 0) > 0 || (presc.count ?? 0) > 0 || (chat.count ?? 0) > 0;
      }

      if (!allowed) {
        return new Response(JSON.stringify({ error: 'no_relationship_with_recipient' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const kindTitle = kind === 'invoice' ? 'Factura / Resumen médico' : kind === 'summary' ? 'Resumen médico' : 'Nota clínica';
    const safeBody = body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
    const html = renderEmail({
      preheader: `${kindTitle} enviada por tu médico vía Medical Masters`,
      accent: "info",
      eyebrow: kindTitle,
      title: kindTitle,
      subtitle: "Documento enviado por un médico verificado a través de Medical Masters.",
      bodyHtml: `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:18px;white-space:pre-wrap;font-size:14px;line-height:22px;color:#0f172a;">${safeBody}</div>`,
      appUrl: "https://medical-masters.com",
    });

    const { error } = await resend.emails.send({
      from: 'Medical Masters <no-reply@medical-masters.com>',
      to,
      subject,
      html,
    });
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? 'send failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

Deno.serve(handler);
