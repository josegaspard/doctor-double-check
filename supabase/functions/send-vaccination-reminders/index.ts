// supabase/functions/send-vaccination-reminders/index.ts
// Cron-triggered: scans patients & their children to detect pending vaccines
// and sends a notification (in-app + push) if eligible.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

import { requireCronSecret, AuthError, corsHeaders } from "../_shared/auth-guards.ts";
// Mirror of src/lib/vaccinationSchemeMX.ts (kept minimal — only fields needed)
type Dose = { doseNumber: number; ageMonths: number; label: string };
type V = { key: string; name: string; ageGroup: string; doses: Dose[] };

const m = (n: number) => n;
const y = (n: number) => n * 12;

const SCHEME: V[] = [
  { key: 'bcg', name: 'BCG', ageGroup: '0-9', doses: [{ doseNumber: 1, label: 'Dosis única', ageMonths: m(0) }] },
  { key: 'hepatitis-b', name: 'Hepatitis B', ageGroup: '0-9', doses: [
    { doseNumber: 1, label: 'Recién nacido', ageMonths: m(0) },
    { doseNumber: 2, label: '2 meses', ageMonths: m(2) },
    { doseNumber: 3, label: '6 meses', ageMonths: m(6) },
  ]},
  { key: 'hexavalente', name: 'Hexavalente acelular', ageGroup: '0-9', doses: [
    { doseNumber: 1, label: '2 meses', ageMonths: m(2) },
    { doseNumber: 2, label: '4 meses', ageMonths: m(4) },
    { doseNumber: 3, label: '6 meses', ageMonths: m(6) },
    { doseNumber: 4, label: '18 meses', ageMonths: m(18) },
  ]},
  { key: 'rotavirus', name: 'Rotavirus', ageGroup: '0-9', doses: [
    { doseNumber: 1, label: '2 meses', ageMonths: m(2) },
    { doseNumber: 2, label: '4 meses', ageMonths: m(4) },
    { doseNumber: 3, label: '6 meses', ageMonths: m(6) },
  ]},
  { key: 'antineumococica-conjugada', name: 'Antineumocócica conjugada', ageGroup: '0-9', doses: [
    { doseNumber: 1, label: '2 meses', ageMonths: m(2) },
    { doseNumber: 2, label: '4 meses', ageMonths: m(4) },
    { doseNumber: 3, label: '12 meses', ageMonths: m(12) },
  ]},
  { key: 'srp', name: 'SRP', ageGroup: '0-9', doses: [
    { doseNumber: 1, label: '12 meses', ageMonths: m(12) },
    { doseNumber: 2, label: '6 años', ageMonths: y(6) },
  ]},
  { key: 'varicela', name: 'Varicela', ageGroup: '0-9', doses: [{ doseNumber: 1, label: '12 meses', ageMonths: m(12) }] },
  { key: 'vph', name: 'VPH', ageGroup: '10-19', doses: [
    { doseNumber: 1, label: '11 años', ageMonths: y(11) },
    { doseNumber: 2, label: '6 meses después', ageMonths: y(11) + 6 },
  ]},
  { key: 'tdpa', name: 'Tdpa', ageGroup: '10-19', doses: [{ doseNumber: 1, label: 'Adolescentes', ageMonths: y(12) }] },
  { key: 'td', name: 'Td (refuerzo cada 10 años)', ageGroup: '20+', doses: [{ doseNumber: 1, label: 'Adulto', ageMonths: y(20) }] },
  { key: 'influenza-adulto', name: 'Influenza estacional', ageGroup: '20+', doses: [{ doseNumber: 1, label: 'Anual', ageMonths: y(20) }] },
  { key: 'antineumococica-13v', name: 'Antineumocócica 13v', ageGroup: '20+', doses: [{ doseNumber: 1, label: '60+ años', ageMonths: y(60) }] },
];

function ageMonths(dob: string): number {
  const d = new Date(dob);
  const now = new Date();
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
}

const REMIND_INTERVAL_DAYS = 30; // do not re-notify within 30 days for same dose

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // SECURITY (2026-05-11 audit): scheduled-only. x-cron-secret header required.
  try { requireCronSecret(req); } catch (__e) {
    if (__e instanceof AuthError) return __e.toResponse();
    return new Response(JSON.stringify({ error: 'auth failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  console.log('[VAX-REMINDERS] starting');

  // 1. Get all patients with reminders enabled
  const { data: patients, error: pErr } = await supabase
    .from('profiles')
    .select('id, name, vaccine_reminders_enabled')
    .eq('vaccine_reminders_enabled', true);

  if (pErr) {
    console.error('[VAX-REMINDERS] profiles error', pErr);
    return new Response(JSON.stringify({ error: pErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let notificationsSent = 0;

  for (const p of patients || []) {
    // Patient's own DOB
    const { data: hist } = await supabase
      .from('patient_clinical_history')
      .select('date_of_birth')
      .eq('patient_id', p.id)
      .maybeSingle();

    const { data: childRows } = await supabase
      .from('child_profiles')
      .select('id, name, date_of_birth')
      .eq('parent_id', p.id);

    const targets: { childId: string | null; dob: string | null; label: string }[] = [
      { childId: null, dob: (hist as any)?.date_of_birth || null, label: 'tu' },
      ...(childRows || []).map((c: any) => ({ childId: c.id, dob: c.date_of_birth, label: `de ${c.name}` })),
    ];

    const { data: existingVacs } = await supabase
      .from('patient_vaccinations')
      .select('vaccine_key, dose_number, child_id, applied, last_reminded_at')
      .eq('patient_id', p.id);

    for (const t of targets) {
      if (!t.dob) continue;
      const months = ageMonths(t.dob);

      const eligibleDoses = SCHEME.flatMap(v =>
        v.doses
          .filter(d => months >= d.ageMonths) // age-eligible
          .map(d => ({ v, d }))
      );

      const pending = eligibleDoses.filter(({ v, d }) => {
        const row = (existingVacs || []).find((r: any) =>
          r.vaccine_key === v.key && r.dose_number === d.doseNumber && (r.child_id || null) === t.childId
        );
        if (row?.applied) return false;
        if (row?.last_reminded_at) {
          const since = (Date.now() - new Date(row.last_reminded_at).getTime()) / 86400000;
          if (since < REMIND_INTERVAL_DAYS) return false;
        }
        return true;
      });

      if (pending.length === 0) continue;

      // Send 1 aggregated notification per target
      const titlePrefix = t.childId ? `Vacunas pendientes ${t.label}` : `Tienes vacunas pendientes`;
      const namesList = pending.slice(0, 3).map(({ v, d }) => `${v.name} (dosis ${d.doseNumber})`).join(', ');
      const more = pending.length > 3 ? ` y ${pending.length - 3} más` : '';

      await supabase.from('notifications').insert({
        user_id: p.id,
        type: 'system',
        title: `💉 ${titlePrefix}`,
        message: `${namesList}${more}. Revisa tu cartilla de vacunación.`,
        data: { url: '/profile', vaccines: pending.map(({ v, d }) => ({ key: v.key, dose: d.doseNumber })) },
      });

      notificationsSent++;

      // Update last_reminded_at for each pending dose (upsert)
      for (const { v, d } of pending) {
        const existing = (existingVacs || []).find((r: any) =>
          r.vaccine_key === v.key && r.dose_number === d.doseNumber && (r.child_id || null) === t.childId
        );
        if (existing) {
          await supabase.from('patient_vaccinations')
            .update({ last_reminded_at: new Date().toISOString() })
            .eq('patient_id', p.id)
            .eq('vaccine_key', v.key)
            .eq('dose_number', d.doseNumber);
        } else {
          await supabase.from('patient_vaccinations').insert({
            patient_id: p.id,
            child_id: t.childId,
            vaccine_key: v.key,
            dose_number: d.doseNumber,
            applied: false,
            last_reminded_at: new Date().toISOString(),
          });
        }
      }
    }
  }

  console.log(`[VAX-REMINDERS] sent ${notificationsSent} notifications`);

  return new Response(JSON.stringify({ ok: true, notificationsSent }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
