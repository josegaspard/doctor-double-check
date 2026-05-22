// SECURITY (2026-05-11 audit): admin-gated manual payout recording.
// Replaces direct client RPC call to process_doctor_payout which was revoked.
import { createClient } from 'npm:@supabase/supabase-js@2.45.0'
import { requireAdminJWT, AuthError, corsHeaders } from '../_shared/auth-guards.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    await requireAdminJWT(req)
  } catch (__e) {
    if (__e instanceof AuthError) return __e.toResponse()
    return new Response(JSON.stringify({ error: 'auth failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: any
  try { body = await req.json() } catch { body = {} }
  const {
    doctor_id, net_amount, gross_amount, reference, notes,
  } = body || {}

  if (!doctor_id || typeof net_amount !== 'number' || typeof gross_amount !== 'number') {
    return new Response(JSON.stringify({ error: 'missing required fields' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (net_amount <= 0 || gross_amount <= 0 || net_amount > gross_amount) {
    return new Response(JSON.stringify({ error: 'invalid amounts' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const now = new Date().toISOString()
  const today = now.split('T')[0]
  const refStr = reference ? `manual_${reference}` : `manual_${Date.now()}`

  // 1. Descontar el saldo PRIMERO. process_doctor_payout bloquea la fila del
  //    doctor (FOR UPDATE) y valida saldo suficiente — esto previene el doble
  //    pago: una segunda llamada concurrente verá saldo 0 y fallará.
  //    El registro del pago sólo se crea si el descuento tuvo éxito.
  const { data: rpcData, error: rpcErr } = await db.rpc('process_doctor_payout', {
    p_doctor_id: doctor_id,
    p_payout_amount: net_amount,
    p_gross_amount: gross_amount,
  })
  if (rpcErr || !rpcData?.success) {
    return new Response(JSON.stringify({ error: rpcErr?.message || rpcData?.error || 'No se pudo procesar el pago' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // 2. Registrar el pago (ya con el saldo descontado).
  const { error: insErr } = await db.from('doctor_payouts').insert({
    doctor_id, amount: net_amount, status: 'paid', paid_at: now,
    period_start: today, period_end: today, stripe_transfer_id: refStr,
  })
  if (insErr) {
    return new Response(JSON.stringify({ error: insErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // 3. In-app notification
  await db.from('notifications').insert({
    user_id: doctor_id,
    type: 'system',
    title: 'Pago procesado',
    message: `Se ha registrado un pago de $${net_amount.toFixed(2)} MXN${notes ? ` - ${notes}` : ''}`,
    data: { amount: net_amount, method: 'manual', reference: reference || null },
  })

  return new Response(JSON.stringify({ success: true, payout: rpcData }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
