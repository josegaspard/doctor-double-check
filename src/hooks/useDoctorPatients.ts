import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Pacientes de un médico — diseño PRO (7-sep-2026).
 *
 * No existe una tabla "pacientes del médico": la relación se deduce de lo que
 * de verdad ha pasado en la plataforma (mismo criterio que usaba el panel):
 *   · conversaciones de chat con un paciente
 *   · consultas realizadas
 *   · citas (pasadas y futuras)
 *   · suscripciones activas a su perfil (seguidores)
 * Todo sale de la base: aquí no se inventa ningún dato.
 */
export type PatientSource = 'chat' | 'consultation' | 'appointment' | 'subscriber';
export type PatientStatus = 'pending' | 'next' | 'followUp' | 'follower' | 'active';

export interface DoctorPatient {
  id: string;
  /** Vacío si la base no deja leer el nombre: la pantalla pone su texto de «sin nombre visible». */
  name: string;
  nameHidden: boolean;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  countryFlag: string | null;
  /** Última interacción de cualquier tipo (ISO) */
  lastInteraction: string | null;
  /** Última consulta o cita pasada (ISO) */
  lastConsultationAt: string | null;
  /** Próxima cita solicitada/confirmada (ISO) */
  nextAppointmentAt: string | null;
  nextAppointmentStatus: string | null;
  nextAppointmentId: string | null;
  consultationsCount: number;
  hasPendingRequest: boolean;
  source: PatientSource;
  tier?: 'free' | 'basic' | 'premium';
  status: PatientStatus;
}

type Entry = {
  lastInteraction: string | null;
  lastConsultationAt: string | null;
  nextAppointmentAt: string | null;
  nextAppointmentStatus: string | null;
  nextAppointmentId: string | null;
  consultationsCount: number;
  hasPendingRequest: boolean;
  source: PatientSource;
  tier?: DoctorPatient['tier'];
};

const later = (a: string | null, b: string | null) => {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
};

export function useDoctorPatients() {
  const { supabaseUser, role } = useAuth();
  const [patients, setPatients] = useState<DoctorPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabaseUser?.id || role !== 'doctor') {
      setPatients([]);
      setLoading(false);
      return;
    }
    const me = supabaseUser.id;
    setLoading(true);
    setError(null);
    try {
      const nowIso = new Date().toISOString();
      const [sessionsRes, consultsRes, subsRes, apptsRes] = await Promise.all([
        supabase
          .from('chat_sessions')
          .select('participant1_id, participant1_type, participant2_id, participant2_type, last_message_at')
          .or(`participant1_id.eq.${me},participant2_id.eq.${me}`)
          .order('last_message_at', { ascending: false }),
        supabase
          .from('consultations')
          .select('patient_id, started_at')
          .eq('doctor_id', me)
          .order('started_at', { ascending: false }),
        supabase
          .from('subscriptions')
          .select('subscriber_id, tier, created_at')
          .eq('creator_id', me)
          .eq('is_active', true),
        supabase
          .from('appointments')
          .select('id, patient_id, scheduled_at, status')
          .eq('doctor_id', me)
          .order('scheduled_at', { ascending: true }),
      ]);

      const firstError = sessionsRes.error || consultsRes.error || apptsRes.error;
      if (firstError) throw firstError;

      const map = new Map<string, Entry>();
      const entryFor = (id: string, source: PatientSource): Entry => {
        let e = map.get(id);
        if (!e) {
          e = {
            lastInteraction: null,
            lastConsultationAt: null,
            nextAppointmentAt: null,
            nextAppointmentStatus: null,
            nextAppointmentId: null,
            consultationsCount: 0,
            hasPendingRequest: false,
            source,
          };
          map.set(id, e);
        }
        return e;
      };

      (sessionsRes.data || []).forEach((s: any) => {
        let patientId: string | null = null;
        if (s.participant1_id === me && s.participant2_type === 'patient') patientId = s.participant2_id;
        else if (s.participant2_id === me && s.participant1_type === 'patient') patientId = s.participant1_id;
        if (!patientId) return;
        const e = entryFor(patientId, 'chat');
        e.lastInteraction = later(e.lastInteraction, s.last_message_at || null);
      });

      (consultsRes.data || []).forEach((c: any) => {
        const e = entryFor(c.patient_id, 'consultation');
        e.consultationsCount += 1;
        e.lastConsultationAt = later(e.lastConsultationAt, c.started_at || null);
        e.lastInteraction = later(e.lastInteraction, c.started_at || null);
      });

      (apptsRes.data || []).forEach((a: any) => {
        const e = entryFor(a.patient_id, 'appointment');
        const isFuture = a.scheduled_at >= nowIso;
        if (isFuture && (a.status === 'requested' || a.status === 'confirmed')) {
          if (!e.nextAppointmentAt || a.scheduled_at < e.nextAppointmentAt) {
            e.nextAppointmentAt = a.scheduled_at;
            e.nextAppointmentStatus = a.status;
            e.nextAppointmentId = a.id;
          }
          if (a.status === 'requested') e.hasPendingRequest = true;
        } else if (!isFuture && a.status !== 'cancelled') {
          e.lastConsultationAt = later(e.lastConsultationAt, a.scheduled_at);
          if (a.status === 'completed') e.consultationsCount += 1;
        }
        e.lastInteraction = later(e.lastInteraction, a.scheduled_at <= nowIso ? a.scheduled_at : null);
      });

      (subsRes.data || []).forEach((s: any) => {
        const e = entryFor(s.subscriber_id, 'subscriber');
        e.tier = s.tier as DoctorPatient['tier'];
        e.lastInteraction = later(e.lastInteraction, s.created_at || null);
      });

      if (map.size === 0) {
        setPatients([]);
        return;
      }

      const ids = Array.from(map.keys());
      // `profiles` trae correo/teléfono cuando la política lo permite (pacientes
      // con relación real con el médico); para el resto, `profiles_public`.
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, name, email, avatar_url, country_flag, phone')
        .in('id', ids);
      const profMap = new Map<string, any>((profs || []).map((p: any) => [p.id, p]));
      const missing = ids.filter(id => !profMap.has(id));
      if (missing.length > 0) {
        const { data: pub } = await supabase
          .from('profiles_public')
          .select('id, name, avatar_url')
          .in('id', missing);
        (pub || []).forEach((p: any) => { if (p?.id) profMap.set(p.id, p); });
      }
      // Los que siguen sin perfil legible (paciente con chat, cita o consulta pero sin
      // expediente compartido): con la migración 20260912 la ficha da nombre y foto,
      // y solo con relación real. Sin ella se listan igual, sin nombre: antes
      // desaparecían de la lista y el médico no podía abrir su ficha.
      const stillMissing = ids.filter(id => !profMap.has(id));
      if (stillMissing.length > 0) {
        const overviews = await Promise.all(
          stillMissing.slice(0, 40).map(id => (supabase.rpc as any)('doctor_get_patient_overview', { p_patient_id: id })),
        );
        overviews.forEach((res: any, i: number) => {
          const pt = res?.data?.patient;
          if (pt?.id) {
            profMap.set(stillMissing[i], { id: pt.id, name: pt.name, avatar_url: pt.avatar_url, email: pt.email, phone: pt.phone, country_flag: pt.country_flag });
          }
        });
      }

      const result: DoctorPatient[] = ids
        // Un seguidor sin perfil legible ni consulta ni cita no es un paciente que listar.
        .filter(id => profMap.has(id) || !(map.get(id)!.source === 'subscriber' && map.get(id)!.consultationsCount === 0 && !map.get(id)!.nextAppointmentAt))
        .map(id => {
          const p = profMap.get(id) || {};
          const e = map.get(id)!;
          let status: PatientStatus = 'active';
          if (e.nextAppointmentAt && e.nextAppointmentStatus === 'requested') status = 'pending';
          else if (e.nextAppointmentAt) status = 'next';
          else if (e.consultationsCount > 0 || e.lastConsultationAt) status = 'followUp';
          else if (e.source === 'subscriber' && (e.tier === 'free' || !e.tier)) status = 'follower';
          return {
            id,
            name: p.name || '',
            nameHidden: !p.name,
            email: p.email ?? null,
            phone: p.phone ?? null,
            avatarUrl: p.avatar_url ?? null,
            countryFlag: p.country_flag ?? null,
            lastInteraction: e.lastInteraction,
            lastConsultationAt: e.lastConsultationAt,
            nextAppointmentAt: e.nextAppointmentAt,
            nextAppointmentStatus: e.nextAppointmentStatus,
            nextAppointmentId: e.nextAppointmentId,
            consultationsCount: e.consultationsCount,
            hasPendingRequest: e.hasPendingRequest,
            source: e.source,
            tier: e.tier,
            status,
          };
        })
        .sort((a, b) => (b.lastInteraction || '').localeCompare(a.lastInteraction || ''));

      setPatients(result);
    } catch (err: any) {
      console.error('[useDoctorPatients]', err);
      setError(err?.message || 'error');
    } finally {
      setLoading(false);
    }
  }, [supabaseUser?.id, role]);

  useEffect(() => { load(); }, [load]);

  return { patients, loading, error, refresh: load };
}
