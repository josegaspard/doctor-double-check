// Auth guards shared by edge functions to close security gaps surfaced in the
// 2026-05-11 audit (open email relays, cron endpoints reachable by anyone,
// webhook signature optionality, etc).
//
// Three guards:
//   requireUserJWT(req, supabase)   — must be an authenticated end-user
//   requireAdminJWT(req, supabase)  — must be an authenticated admin
//   requireCronSecret(req)          — must come from our own cron / a trusted
//                                     internal caller carrying the shared
//                                     CRON_SECRET header.
//
// All return either a User object (or true) on success, or throw a Response
// the caller should `return` directly so the request is short-circuited with
// the right status code.

import { createClient, type User } from 'npm:@supabase/supabase-js@2.45.0'

// Default CORS headers (wildcard). Used by helper error responses. For new code
// prefer `corsHeadersFor(req)` below which echoes back only allowlisted origins.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

// Allowlist of origins permitted to call our edge functions from browsers.
// Mobile/native (Capacitor) and local dev included.
const ALLOWED_ORIGINS = new Set([
  'https://medical-masters.com',
  'https://www.medical-masters.com',
  'capacitor://localhost',
  'http://localhost',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://localhost:3000',
])

/**
 * Build CORS headers that echo only allowlisted Origins. Falls back to the
 * canonical production origin when the request has no Origin (server-to-server
 * or non-browser callers). Always sets Vary: Origin so caches don't bleed.
 */
export function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || ''
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : 'https://medical-masters.com'
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

export class AuthError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
  toResponse() {
    return new Response(JSON.stringify({ error: this.message }), {
      status: this.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
}

/** Pull and verify a Bearer JWT; returns the auth.users row. Throws AuthError. */
export async function requireUserJWT(req: Request): Promise<User> {
  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) throw new AuthError(401, 'Missing Authorization header')

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  )
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) throw new AuthError(401, 'Invalid or expired token')
  return data.user
}

/** Verify the caller is an admin. Returns the User. Throws on non-admin. */
export async function requireAdminJWT(req: Request): Promise<User> {
  const user = await requireUserJWT(req)
  const service = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )
  const { data, error } = await service
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle()
  if (error) throw new AuthError(500, 'Role check failed')
  if (!data) throw new AuthError(403, 'Admin role required')
  return user
}

/** Constant-time string compare for shared secrets. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Lee el claim `role` de un JWT SIN verificar la firma (solo para decidir si
 *  merece la pena verificarlo). */
function unverifiedJwtRole(token: string): string | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)))
    return typeof payload?.role === 'string' ? payload.role : null
  } catch {
    return null
  }
}

/** ¿La petición viene de otra función con la clave de servicio?
 *  Con las claves nuevas (sb_secret_…) el gateway cambia el Authorization por
 *  un JWT acuñado (cabecera sb-api-key-compatibility: minted), así que comparar
 *  el Bearer con SUPABASE_SERVICE_ROLE_KEY ya no basta (2026-10-03: admin-refund
 *  → send-refund-email y wallet → send-purchase-email daban 401). Se acepta:
 *  1) Bearer o apikey idénticos a la clave de servicio;
 *  2) un JWT con role service_role cuya firma valida GoTrue (endpoint admin,
 *     que solo responde 200 a un service_role auténtico).                     */
async function isServiceRoleCall(req: Request): Promise<boolean> {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!serviceKey) return false
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  const apikey = (req.headers.get('apikey') || '').trim()
  if (token && timingSafeEqual(token, serviceKey)) return true
  if (apikey && timingSafeEqual(apikey, serviceKey)) return true
  if (!token || unverifiedJwtRole(token) !== 'service_role') return false
  try {
    const res = await fetch(`${Deno.env.get('SUPABASE_URL') ?? ''}/auth/v1/admin/users?page=1&per_page=1`, {
      // apikey = anon (NUNCA la secreta): así el gateway no acuña su propio JWT
      // y GoTrue valida la firma y el rol del token recibido.
      headers: { Authorization: `Bearer ${token}`, apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '' },
    })
    await res.body?.cancel()
    return res.ok
  } catch {
    return false
  }
}

/** Verify x-cron-secret header matches env CRON_SECRET. For scheduled jobs and
 *  internal-only callers. Throws AuthError on mismatch.                       */
export function requireCronSecret(req: Request): void {
  const expected = Deno.env.get('CRON_SECRET')
  if (!expected) throw new AuthError(500, 'Server cron secret not configured')
  const got = req.headers.get('x-cron-secret') || ''
  if (!timingSafeEqual(got, expected)) throw new AuthError(401, 'Invalid cron secret')
}

/** Verify caller is either an admin (JWT), a cron caller (shared secret) OR
 *  another edge function using the service-role key (e.g. admin-refund →
 *  send-refund-email, stripe-webhook → send-purchase-email). */
export async function requireAdminOrCron(req: Request): Promise<void> {
  if (req.headers.get('x-cron-secret')) {
    requireCronSecret(req)
    return
  }
  if (await isServiceRoleCall(req)) return
  await requireAdminJWT(req)
}

/**
 * Accept either an authenticated end-user JWT OR a service-role call from
 * another edge function (e.g. stripe-webhook → notify-admin). Returns the User
 * when a JWT was used, or null when called with the service-role key.
 */
export async function requireUserOrService(req: Request): Promise<User | null> {
  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) throw new AuthError(401, 'Missing Authorization header')

  if (await isServiceRoleCall(req)) return null

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  )
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) throw new AuthError(401, 'Invalid or expired token')
  return data.user
}

export { corsHeaders }
