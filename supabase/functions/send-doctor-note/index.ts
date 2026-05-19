import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/auth-guards.ts";

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

    const html = `
      <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
        <h2 style="margin:0 0 12px;color:#163a83">${kind === 'invoice' ? 'Factura / Resumen médico' : kind === 'summary' ? 'Resumen médico' : 'Nota clínica'}</h2>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;white-space:pre-wrap;font-size:14px;line-height:1.55">${
          body.replace(/[<>]/g, (c) => c === '<' ? '&lt;' : '&gt;')
        }</div>
        <p style="font-size:11px;color:#64748b;margin-top:16px">Enviado por un médico verificado a través de Medical Masters.</p>
      </div>
    `;

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
