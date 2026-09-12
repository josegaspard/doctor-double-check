// Horario del médico por día de la semana y por días sueltos del mes (11-sep-2026).
//
// Fuente: tabla doctor_schedule_ranges (migración 20260912_reestructura_medico).
// Regla: si una fecha concreta tiene tramos, esos mandan y anulan los de su día de
// la semana; si todos los tramos de esa fecha están inactivos, ese día no atiende.
//
// Antes de aplicar la migración la tabla no existe: el hook lee el horario antiguo
// (office_days + office_hours_*) en SOLO LECTURA y marca `pendingActivation`, para
// que la pantalla lo diga en lugar de fingir que guarda.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { isMissingDbObject } from '@/hooks/useCreateAppointment';

const sb = supabase as any;

export const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

export interface ScheduleRange {
  id?: string;
  /** 0 = domingo … 6 = sábado. Exactamente uno de weekday / specific_date. */
  weekday: number | null;
  /** YYYY-MM-DD */
  specific_date: string | null;
  /** HH:mm o HH:mm:ss */
  start_time: string;
  end_time: string;
  is_active: boolean;
  timezone?: string;
}

export interface EffectiveRange {
  day: string;
  start_time: string;
  end_time: string;
  source: 'date' | 'weekday' | 'legacy';
}

export type ScheduleSaveResult =
  | { ok: true }
  | { ok: false; reason: 'pending_activation' | 'invalid' | 'forbidden' | 'error'; error?: any };

const hhmm = (t: string) => (t || '').slice(0, 5);

const toDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Rangos efectivos de cada día entre dos fechas, calculados en el navegador (vista previa del editor). */
export function resolveEffectiveRanges(ranges: ScheduleRange[], from: Date, to: Date): EffectiveRange[] {
  const out: EffectiveRange[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  while (cursor <= end) {
    const key = toDateKey(cursor);
    const dated = ranges.filter((r) => r.specific_date === key);
    if (dated.length) {
      dated
        .filter((r) => r.is_active)
        .forEach((r) => out.push({ day: key, start_time: hhmm(r.start_time), end_time: hhmm(r.end_time), source: 'date' }));
    } else {
      ranges
        .filter((r) => r.weekday === cursor.getDay() && r.is_active)
        .forEach((r) => out.push({ day: key, start_time: hhmm(r.start_time), end_time: hhmm(r.end_time), source: 'weekday' }));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return out.sort((a, b) => (a.day === b.day ? a.start_time.localeCompare(b.start_time) : a.day.localeCompare(b.day)));
}

/** Comprueba tramos: fin después de inicio y sin solaparse dentro del mismo día o fecha. */
export function validateRanges(ranges: ScheduleRange[]): string | null {
  const groups = new Map<string, ScheduleRange[]>();
  for (const r of ranges) {
    if ((r.weekday === null) === (r.specific_date === null)) return 'target';
    if (hhmm(r.end_time) <= hhmm(r.start_time)) return 'order';
    const key = r.specific_date ? `d:${r.specific_date}` : `w:${r.weekday}`;
    groups.set(key, [...(groups.get(key) || []), r]);
  }
  for (const list of groups.values()) {
    const sorted = list.filter((r) => r.is_active).sort((a, b) => hhmm(a.start_time).localeCompare(hhmm(b.start_time)));
    for (let i = 1; i < sorted.length; i++) {
      if (hhmm(sorted[i].start_time) < hhmm(sorted[i - 1].end_time)) return 'overlap';
    }
  }
  return null;
}

function legacyToRanges(profile: any): ScheduleRange[] {
  const days: string[] = Array.isArray(profile?.office_days) ? profile.office_days : [];
  const start = hhmm(profile?.office_hours_start || '08:00');
  const end = hhmm(profile?.office_hours_end || '20:00');
  if (end <= start) return [];
  return days
    .map((d) => WEEKDAY_KEYS.indexOf(String(d).toLowerCase() as (typeof WEEKDAY_KEYS)[number]))
    .filter((i) => i >= 0)
    .map((weekday) => ({ weekday, specific_date: null, start_time: start, end_time: end, is_active: true }));
}

const sameRange = (a: ScheduleRange, b: ScheduleRange) =>
  a.weekday === b.weekday &&
  a.specific_date === b.specific_date &&
  hhmm(a.start_time) === hhmm(b.start_time) &&
  hhmm(a.end_time) === hhmm(b.end_time) &&
  a.is_active === b.is_active;

export function useDoctorScheduleRanges(doctorId?: string) {
  const { user } = useAuth();
  const id = doctorId || user?.id;
  const [ranges, setRanges] = useState<ScheduleRange[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingActivation, setPendingActivation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await sb
      .from('doctor_schedule_ranges')
      .select('id, weekday, specific_date, start_time, end_time, is_active, timezone')
      .eq('doctor_id', id)
      .order('specific_date', { ascending: true, nullsFirst: true })
      .order('weekday', { ascending: true })
      .order('start_time', { ascending: true });

    if (err) {
      if (isMissingDbObject(err)) {
        setPendingActivation(true);
        const { data: profile } = await sb
          .from('doctor_profiles')
          .select('office_days, office_hours_start, office_hours_end')
          .eq('user_id', id)
          .maybeSingle();
        setRanges(legacyToRanges(profile));
      } else {
        console.error('[useDoctorScheduleRanges]', err);
        setError(err.message);
      }
      setLoading(false);
      return;
    }
    setPendingActivation(false);
    setRanges(
      (data || []).map((r: any) => ({
        ...r,
        start_time: hhmm(r.start_time),
        end_time: hhmm(r.end_time),
      })),
    );
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  /** Guarda el horario completo: borra lo quitado, actualiza lo cambiado e inserta lo nuevo. */
  const saveAll = useCallback(
    async (next: ScheduleRange[]): Promise<ScheduleSaveResult> => {
      if (!id) return { ok: false, reason: 'forbidden' };
      if (pendingActivation) return { ok: false, reason: 'pending_activation' };
      if (validateRanges(next)) return { ok: false, reason: 'invalid' };
      setSaving(true);
      try {
        const keep = new Set(next.filter((r) => r.id).map((r) => r.id as string));
        const removed = ranges.filter((r) => r.id && !keep.has(r.id)).map((r) => r.id as string);
        if (removed.length) {
          const { error: delErr } = await sb.from('doctor_schedule_ranges').delete().in('id', removed);
          if (delErr) throw delErr;
        }
        for (const r of next.filter((x) => x.id)) {
          const before = ranges.find((x) => x.id === r.id);
          if (before && sameRange(before, r)) continue;
          const { error: upErr } = await sb
            .from('doctor_schedule_ranges')
            .update({ weekday: r.weekday, specific_date: r.specific_date, start_time: r.start_time, end_time: r.end_time, is_active: r.is_active })
            .eq('id', r.id);
          if (upErr) throw upErr;
        }
        const inserts = next
          .filter((r) => !r.id)
          .map((r) => ({
            doctor_id: id,
            weekday: r.weekday,
            specific_date: r.specific_date,
            start_time: r.start_time,
            end_time: r.end_time,
            is_active: r.is_active,
            timezone: r.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Mexico_City',
          }));
        if (inserts.length) {
          const { error: insErr } = await sb.from('doctor_schedule_ranges').insert(inserts);
          if (insErr) throw insErr;
        }
        await load();
        return { ok: true };
      } catch (err: any) {
        if (isMissingDbObject(err)) {
          setPendingActivation(true);
          return { ok: false, reason: 'pending_activation', error: err };
        }
        console.error('[useDoctorScheduleRanges] saveAll', err);
        const code = String(err?.code || '');
        return { ok: false, reason: code === '42501' ? 'forbidden' : ['23514', '23505', '22007'].includes(code) ? 'invalid' : 'error', error: err };
      } finally {
        setSaving(false);
      }
    },
    [id, pendingActivation, ranges, load],
  );

  /** Rangos efectivos por día desde la base (o calculados en local si falta la migración). */
  const getEffective = useCallback(
    async (from: Date, to: Date): Promise<EffectiveRange[]> => {
      if (!id) return [];
      const { data, error: err } = await sb.rpc('get_doctor_schedule', {
        p_doctor_id: id,
        p_from: toDateKey(from),
        p_to: toDateKey(to),
      });
      if (err) {
        if (!isMissingDbObject(err)) console.error('[useDoctorScheduleRanges] get_doctor_schedule', err);
        return resolveEffectiveRanges(ranges, from, to).map((r) => ({ ...r, source: pendingActivation ? 'legacy' : r.source }));
      }
      return (data || []).map((r: any) => ({ day: r.day, start_time: hhmm(r.start_time), end_time: hhmm(r.end_time), source: r.source }));
    },
    [id, ranges, pendingActivation],
  );

  return { ranges, setRanges, loading, saving, error, pendingActivation, reload: load, saveAll, getEffective };
}

export default useDoctorScheduleRanges;
