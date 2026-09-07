import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDoctorAvailability, DoctorAvailability } from '@/hooks/useDoctorAvailability';

/**
 * Agenda profesional del médico — diseño PRO (7-sep-2026).
 * Une en una sola lista lo que hoy vive en dos tablas:
 *   · `appointments`        → citas con pacientes (solicitadas, confirmadas, …)
 *   · `doctor_availability` → lives programados, orientaciones, horas
 *                              disponibles y bloqueos ('blocked')
 */
export type AgendaKind = 'appointment' | 'live' | 'consultation' | 'office_hours' | 'blocked';

export interface AgendaEvent {
  id: string;
  kind: AgendaKind;
  start: Date;
  end: Date;
  title: string;
  subtitle?: string;
  status: string;
  patientId?: string;
  patientName?: string;
  patientAvatar?: string | null;
  roomUrl?: string | null;
  reason?: string | null;
  durationMinutes: number;
  raw: any;
}

export interface AgendaAppointment {
  id: string;
  patient_id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  reason: string | null;
  daily_room_url: string | null;
  patient_name?: string | null;
  patient_avatar?: string | null;
}

export function useDoctorAgenda(rangeStart: Date, rangeEnd: Date) {
  const { supabaseUser, role } = useAuth();
  const { myAvailabilities, isLoading: availLoading, refresh: refreshAvail } = useDoctorAvailability();
  const [appointments, setAppointments] = useState<AgendaAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const startMs = rangeStart.getTime();
  const endMs = rangeEnd.getTime();

  const load = useCallback(async () => {
    if (!supabaseUser?.id || role !== 'doctor') {
      setAppointments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from('appointments')
        .select('id, patient_id, scheduled_at, duration_minutes, status, reason, daily_room_url')
        .eq('doctor_id', supabaseUser.id)
        .gte('scheduled_at', new Date(startMs).toISOString())
        .lte('scheduled_at', new Date(endMs).toISOString())
        .order('scheduled_at', { ascending: true });
      if (qErr) throw qErr;
      const rows = (data as any[]) || [];
      const ids = [...new Set(rows.map(r => r.patient_id))];
      const profMap: Record<string, any> = {};
      if (ids.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, name, avatar_url').in('id', ids);
        (profs || []).forEach((p: any) => { profMap[p.id] = p; });
        const missing = ids.filter(id => !profMap[id]);
        if (missing.length > 0) {
          const { data: pub } = await supabase.from('profiles_public').select('id, name, avatar_url').in('id', missing);
          (pub || []).forEach((p: any) => { if (p?.id) profMap[p.id] = p; });
        }
      }
      setAppointments(rows.map(r => ({
        ...r,
        patient_name: profMap[r.patient_id]?.name ?? null,
        patient_avatar: profMap[r.patient_id]?.avatar_url ?? null,
      })));
    } catch (err: any) {
      console.error('[useDoctorAgenda]', err);
      setError(err?.message || 'error');
    } finally {
      setLoading(false);
    }
  }, [supabaseUser?.id, role, startMs, endMs]);

  useEffect(() => { load(); }, [load]);

  const events = useMemo<AgendaEvent[]>(() => {
    const list: AgendaEvent[] = [];
    appointments.forEach(a => {
      const start = new Date(a.scheduled_at);
      const dur = a.duration_minutes || 30;
      list.push({
        id: `appt-${a.id}`,
        kind: 'appointment',
        start,
        end: new Date(start.getTime() + dur * 60000),
        title: a.patient_name || 'Paciente',
        subtitle: a.reason || undefined,
        status: a.status,
        patientId: a.patient_id,
        patientName: a.patient_name || undefined,
        patientAvatar: a.patient_avatar,
        roomUrl: a.daily_room_url,
        reason: a.reason,
        durationMinutes: dur,
        raw: a,
      });
    });
    (myAvailabilities as DoctorAvailability[]).forEach(av => {
      if (av.status === 'cancelled') return;
      const t = av.scheduledAt.getTime();
      if (t < startMs || t > endMs) return;
      const kind: AgendaKind = (['live', 'consultation', 'office_hours', 'blocked'] as AgendaKind[]).includes(av.type as AgendaKind)
        ? (av.type as AgendaKind)
        : 'office_hours';
      list.push({
        id: `avail-${av.id}`,
        kind,
        start: av.scheduledAt,
        end: new Date(t + (av.durationMinutes || 60) * 60000),
        title: av.title,
        subtitle: av.description,
        status: av.status,
        durationMinutes: av.durationMinutes || 60,
        raw: av,
      });
    });
    return list.sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [appointments, myAvailabilities, startMs, endMs]);

  /** Bloquea un tramo: se guarda como disponibilidad de tipo 'blocked' (privada). */
  const createBlock = useCallback(async (opts: { start: Date; durationMinutes: number; title?: string }) => {
    if (!supabaseUser?.id) return { success: false, error: 'Not authenticated' };
    const { error: insErr } = await supabase
      .from('doctor_availability')
      .insert({
        doctor_id: supabaseUser.id,
        title: (opts.title || '').trim() || 'No disponible',
        scheduled_at: opts.start.toISOString(),
        duration_minutes: opts.durationMinutes,
        type: 'blocked',
        status: 'confirmed',
        notifications_sent: true,
      } as any);
    if (insErr) return { success: false, error: insErr.message };
    await refreshAvail();
    return { success: true };
  }, [supabaseUser?.id, refreshAvail]);

  const removeBlock = useCallback(async (availabilityId: string) => {
    if (!supabaseUser?.id) return { success: false, error: 'Not authenticated' };
    const { error: delErr } = await supabase
      .from('doctor_availability')
      .delete()
      .eq('id', availabilityId)
      .eq('doctor_id', supabaseUser.id);
    if (delErr) return { success: false, error: delErr.message };
    await refreshAvail();
    return { success: true };
  }, [supabaseUser?.id, refreshAvail]);

  const refresh = useCallback(async () => {
    await Promise.all([load(), refreshAvail()]);
  }, [load, refreshAvail]);

  return {
    events,
    appointments,
    availabilities: myAvailabilities as DoctorAvailability[],
    loading: loading || availLoading,
    error,
    refresh,
    createBlock,
    removeBlock,
  };
}
