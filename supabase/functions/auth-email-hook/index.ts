// MIGRATION 2026-05-08: Lovable Cloud → external Supabase. Resend SDK + standardwebhooks.
// To revert: swap LOVABLE-LEGACY <-> NATIVE-IMPL blocks below.

// ─── LOVABLE-LEGACY (kept for rollback) ─────────────────────────────────────
// import { sendLovableEmail, parseEmailWebhookPayload } from 'npm:@lovable.dev/email-js'
// import { WebhookError, verifyWebhookRequest } from 'npm:@lovable.dev/webhooks-js'

// ─── NATIVE-IMPL (active, post-migration) ───────────────────────────────────
import { Resend } from 'npm:resend@4.0.0'
import { Webhook } from 'npm:standardwebhooks@1.0.0'

import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { SignupEmail } from '../_shared/email-templates/signup.tsx'
import { InviteEmail } from '../_shared/email-templates/invite.tsx'
import { MagicLinkEmail } from '../_shared/email-templates/magic-link.tsx'
import { RecoveryEmail } from '../_shared/email-templates/recovery.tsx'
import { EmailChangeEmail } from '../_shared/email-templates/email-change.tsx'
import { ReauthenticationEmail } from '../_shared/email-templates/reauthentication.tsx'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-lovable-signature, x-lovable-timestamp, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const EMAIL_SUBJECTS: Record<string, string> = {
  signup: 'Confirma tu correo - Medical Masters',
  invite: 'Te han invitado a Medical Masters',
  magiclink: 'Tu enlace de acceso - Medical Masters',
  recovery: 'Restablece tu contraseña - Medical Masters',
  email_change: 'Confirma el cambio de correo - Medical Masters',
  reauthentication: 'Tu código de verificación - Medical Masters',
}

const EMAIL_TEMPLATES: Record<string, React.ComponentType<any>> = {
  signup: SignupEmail,
  invite: InviteEmail,
  magiclink: MagicLinkEmail,
  recovery: RecoveryEmail,
  email_change: EmailChangeEmail,
  reauthentication: ReauthenticationEmail,
}

const SITE_NAME = "Medical Masters"
const SENDER_DOMAIN = "notify.cirugiaesteticauribe.com"
const ROOT_DOMAIN = "cirugiaesteticauribe.com"
const FROM_DOMAIN = "cirugiaesteticauribe.com"

const SAMPLE_PROJECT_URL = "https://cirugiaesteticauribe.com"
const SAMPLE_EMAIL = "user@example.test"
const SAMPLE_DATA: Record<string, object> = {
  signup: {
    siteName: SITE_NAME,
    siteUrl: SAMPLE_PROJECT_URL,
    recipient: SAMPLE_EMAIL,
    confirmationUrl: SAMPLE_PROJECT_URL,
    userRole: 'doctor',
  },
  magiclink: {
    siteName: SITE_NAME,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  recovery: {
    siteName: SITE_NAME,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  invite: {
    siteName: SITE_NAME,
    siteUrl: SAMPLE_PROJECT_URL,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  email_change: {
    siteName: SITE_NAME,
    email: SAMPLE_EMAIL,
    newEmail: SAMPLE_EMAIL,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  reauthentication: {
    token: '123456',
  },
}

// Helper: fetch user role from user_roles table using service role key
async function getUserRole(userId: string): Promise<string | null> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      console.warn('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for role lookup')
      return null
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()
    if (error) {
      console.warn('Error fetching user role:', error.message)
      return null
    }
    return data?.role ?? null
  } catch (e) {
    console.warn('getUserRole exception:', e)
    return null
  }
}

// Preview endpoint handler
async function handlePreview(req: Request): Promise<Response> {
  const previewCorsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: previewCorsHeaders })
  }

  // ─── LOVABLE-LEGACY (kept for rollback) ───────────────────────────────────
  // const apiKey = Deno.env.get('LOVABLE_API_KEY')
  // const authHeader = req.headers.get('Authorization')
  // if (!apiKey || authHeader !== `Bearer ${apiKey}`) { return 401 }

  // ─── NATIVE-IMPL (active, post-migration) ─────────────────────────────────
  // Auth preview endpoint with service role key (admin-only access)
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authHeader = req.headers.get('Authorization')

  if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let type: string
  try {
    const body = await req.json()
    type = body.type
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
      status: 400,
      headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const EmailTemplate = EMAIL_TEMPLATES[type]

  if (!EmailTemplate) {
    return new Response(JSON.stringify({ error: `Unknown email type: ${type}` }), {
      status: 400,
      headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const sampleData = SAMPLE_DATA[type] || {}
  const html = await renderAsync(React.createElement(EmailTemplate, sampleData))

  return new Response(html, {
    status: 200,
    headers: { ...previewCorsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
  })
}

// Webhook handler
async function handleWebhook(req: Request): Promise<Response> {
  // ─── LOVABLE-LEGACY (kept for rollback) ───────────────────────────────────
  // const apiKey = Deno.env.get('LOVABLE_API_KEY')
  // if (!apiKey) { return 500 }
  // let payload, run_id
  // try {
  //   const verified = await verifyWebhookRequest({ req, secret: apiKey, parser: parseEmailWebhookPayload })
  //   payload = verified.payload; run_id = payload.run_id
  // } catch (error) {
  //   if (error instanceof WebhookError) { switch (error.code) { ...invalid_signature/timestamp/payload/json } }
  //   return 400
  // }

  // ─── NATIVE-IMPL (active, post-migration) ─────────────────────────────────
  // Standard webhooks (Supabase Auth Email Hook). Secret format: "v1,whsec_<base64>"; standardwebhooks expects only the base64 part.
  const sendEmailHookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET')
  if (!sendEmailHookSecret) {
    console.error('SEND_EMAIL_HOOK_SECRET not configured')
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  let payload: any
  let run_id = ''
  try {
    const whSecret = sendEmailHookSecret.replace(/^v1,/, '')
    const wh = new Webhook(whSecret)
    const body = await req.text()
    const headers = {
      'webhook-id': req.headers.get('webhook-id') ?? '',
      'webhook-timestamp': req.headers.get('webhook-timestamp') ?? '',
      'webhook-signature': req.headers.get('webhook-signature') ?? '',
    }
    payload = wh.verify(body, headers) as any
    // Supabase Auth Email Hook payload shape doesn't include run_id; synthesize one for logging
    run_id = `${payload?.user?.id ?? 'unknown'}-${Date.now()}`
    // Adapt payload to legacy shape used downstream
    if (payload?.user && payload?.email_data) {
      payload = {
        version: '1',
        run_id,
        data: {
          action_type: payload.email_data.email_action_type,
          email: payload.user.email,
          new_email: payload.user.new_email,
          token: payload.email_data.token,
          token_hash: payload.email_data.token_hash,
          url: `${payload.email_data.site_url}/auth/v1/verify?token=${payload.email_data.token_hash}&type=${payload.email_data.email_action_type}&redirect_to=${encodeURIComponent(payload.email_data.redirect_to ?? '/')}`,
          callback_url: payload.email_data.callback_url ?? '',
          user_id: payload.user.id,
        },
      }
    }
  } catch (error) {
    console.error('Webhook verification failed', { error: error instanceof Error ? error.message : String(error) })
    return new Response(
      JSON.stringify({ error: 'Invalid signature or payload' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (!run_id) {
    console.error('Webhook payload missing run_id')
    return new Response(
      JSON.stringify({ error: 'Invalid webhook payload' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (payload.version !== '1') {
    console.error('Unsupported payload version', { version: payload.version, run_id })
    return new Response(
      JSON.stringify({ error: `Unsupported payload version: ${payload.version}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const emailType = payload.data.action_type
  console.log('Received auth event', { emailType, email: payload.data.email, run_id })

  const EmailTemplate = EMAIL_TEMPLATES[emailType]
  if (!EmailTemplate) {
    console.error('Unknown email type', { emailType, run_id })
    return new Response(
      JSON.stringify({ error: `Unknown email type: ${emailType}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Per-email rate limit on recovery/email_change/signup so an attacker can't
  // flood a target's inbox by repeatedly POSTing to /auth endpoints.
  if (['recovery', 'email_change', 'signup', 'invite'].includes(emailType) && payload.data.email) {
    try {
      const sb = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      const { data: allowed, error: rlErr } = await sb.rpc('check_and_record_rate_limit', {
        p_bucket: `auth_email_${emailType}`,
        p_key: String(payload.data.email).toLowerCase(),
        p_max: emailType === 'recovery' ? 3 : 5,
        p_window_seconds: 3600,
      })
      if (rlErr) {
        console.warn('Rate-limit RPC error (allowing through)', { error: rlErr.message, run_id })
      } else if (allowed === false) {
        console.warn('Auth email rate-limited', { emailType, email: payload.data.email, run_id })
        // Return 200 silently so we don't leak existence of the email
        return new Response(JSON.stringify({ ok: true, rate_limited: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    } catch (e) {
      console.warn('Rate-limit unexpected error (allowing through)', { error: String(e), run_id })
    }
  }

  // Build template props
  const templateProps: Record<string, any> = {
    siteName: SITE_NAME,
    siteUrl: `https://${ROOT_DOMAIN}`,
    recipient: payload.data.email,
    confirmationUrl: payload.data.url,
    token: payload.data.token,
    email: payload.data.email,
    newEmail: payload.data.new_email,
  }

  // For signup emails, look up the user's role to customize onboarding content
  if (emailType === 'signup' && payload.data.user_id) {
    const userRole = await getUserRole(payload.data.user_id)
    if (userRole) {
      templateProps.userRole = userRole
      console.log('Signup email with role-specific onboarding', { userRole, run_id })
    }
  }

  const html = await renderAsync(React.createElement(EmailTemplate, templateProps))
  const text = await renderAsync(React.createElement(EmailTemplate, templateProps), {
    plainText: true,
  })

  // Customize subject for doctor/resident signup
  let subject = EMAIL_SUBJECTS[emailType] || 'Notification'
  if (emailType === 'signup' && templateProps.userRole === 'doctor') {
    subject = 'Confirma tu correo y comienza tu verificación - Medical Masters'
  } else if (emailType === 'signup' && templateProps.userRole === 'resident') {
    subject = 'Confirma tu correo - Bienvenido Residente - Medical Masters'
  }

  const callbackUrl = payload.data.callback_url
  if (!callbackUrl) {
    console.error('No callback_url in payload', { run_id })
    return new Response(JSON.stringify({ error: 'Missing callback_url in payload' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // ─── LOVABLE-LEGACY (kept for rollback) ─────────────────────────────────
  // let result
  // try {
  //   result = await sendLovableEmail(
  //     { run_id, to: payload.data.email, from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
  //       sender_domain: SENDER_DOMAIN, subject, html, text, purpose: 'transactional' },
  //     { apiKey, sendUrl: callbackUrl }
  //   )
  // } catch (error) { return 500 }

  // ─── NATIVE-IMPL (active, post-migration) ───────────────────────────────
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    console.error('RESEND_API_KEY not configured')
    return new Response(JSON.stringify({ error: 'Email service not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const resend = new Resend(resendApiKey)
  const fromEmail = Deno.env.get('FROM_EMAIL') || 'onboarding@resend.dev'

  let result: { message_id?: string } = {}
  try {
    const sent = await resend.emails.send({
      from: `${SITE_NAME} <${fromEmail}>`,
      to: payload.data.email,
      subject,
      html,
      text,
    })
    if (sent.error) throw new Error(sent.error.message ?? 'Resend send failed')
    result = { message_id: sent.data?.id }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send email'
    console.error('Resend API error', { error: message, run_id })
    return new Response(JSON.stringify({ error: 'Failed to send email' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  console.log('Email sent successfully', { message_id: result.message_id, run_id })

  return new Response(
    JSON.stringify({ success: true, message_id: result.message_id }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

Deno.serve(async (req) => {
  const url = new URL(req.url)

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (url.pathname.endsWith('/preview')) {
    return handlePreview(req)
  }

  try {
    return await handleWebhook(req)
  } catch (error) {
    console.error('Webhook handler error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
