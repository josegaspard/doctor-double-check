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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
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

/** Verify x-cron-secret header matches env CRON_SECRET. For scheduled jobs and
 *  internal-only callers. Throws AuthError on mismatch.                       */
export function requireCronSecret(req: Request): void {
  const expected = Deno.env.get('CRON_SECRET')
  if (!expected) throw new AuthError(500, 'Server cron secret not configured')
  const got = req.headers.get('x-cron-secret') || ''
  if (!timingSafeEqual(got, expected)) throw new AuthError(401, 'Invalid cron secret')
}

/** Verify caller is either an admin (JWT) OR a cron caller (shared secret). */
export async function requireAdminOrCron(req: Request): Promise<void> {
  if (req.headers.get('x-cron-secret')) {
    requireCronSecret(req)
    return
  }
  await requireAdminJWT(req)
}

export { corsHeaders }
