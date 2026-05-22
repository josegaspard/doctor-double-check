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
  const isDoctor = (roles ?? []).some((r: any) => r.role === 'doctor' || r.role === 'admin');
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
