import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Consultas del médico — diseño PRO, 2.ª tanda (8-sep-2026).
 *
 * En la plataforma una "consulta" puede llegar por dos caminos REALES, y la
 * pantalla une los dos sin inventarse ninguno:
 *   · `appointments`  — cita agendada por el paciente (con hora y duración)
 *   · `consultations` — consulta abierta desde el chat de pago / videollamada
 *
 * Todo lo que se pinta sale de la base. Lo que la base no guarda (por ejemplo
 * si la consulta es presencial, o el cobro de una cita concreta) NO se enseña:
 * en su lugar van los datos que sí existen (sala de vídeo, tarifa publicada,
 * documentos compartidos, receta emitida, valoración del paciente).
 */
export type ConsultKind = 'appointment' | 'chat';

/** Estados derivados que usan las pestañas de la pantalla */
export type ConsultStatus =
  | 'requested'   // solicitada por el paciente, sin confirmar
  | 'confirmed'   // confirmada y todavía por delante
  | 'ongoing'     // sucediendo ahora (o consulta de chat abierta)
  | 'toClose'     // ya pasó su hora y sigue sin cerrarse
  | 'followUp'    // atendida, pero la conversación con el paciente sigue abierta
  | 'completed'
  | 'cancelled';

export interface DoctorConsultation {
  id: string;
  kind: ConsultKind;
  patientId: string;
  patientName: string;
  patientAvatar: string | null;
  /** ISO — hora de la cita o inicio de la consulta de chat */
  at: string;
  /** minutos; las consultas de chat no tienen duración pactada */
  durationMinutes: number | null;
  status: ConsultStatus;
  /** el valor tal cual está en la base, para no perder información */
  rawStatus: string;
  reason: string | null;
  notes: string | null;
  roomUrl: string | null;
  cancellationReason: string | null;
  chatSessionId: string | null;
  hasOpenChat: boolean;
  hasPrescription: boolean;
  documentsCount: number;
  rating: number | null;
  summary: string | null;
  diagnosis: string | null;
  recommendations: string | null;
  completedAt: string | null;
}

export interface ConsultationsData {
  items: DoctorConsultation[];
  consultationFee: number;
  loading: boolean;
  error: boolean;
  refresh: () => Promise<void>;
}

const iso = (v: any): string | null => (v ? String(v) : null);

export function useDoctorConsultations(): ConsultationsData {
  const { user, role } = useAuth();
  const [items, setItems] = useState<DoctorConsultation[]>([]);
  const [consultationFee, setConsultationFee] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id || role !== 'doctor') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const [apptRes, consRes, feeRes, chatRes] = await Promise.all([
        supabase
          .from('appointments')
          .select('id, patient_id, scheduled_at, duration_minutes, status, reason, notes, daily_room_url, cancellation_reason')
          .eq('doctor_id', user.id)
          .order('scheduled_at', { ascending: false }),
        supabase
          .from('consultations')
          .select('id, patient_id, chat_session_id, started_at, ended_at, completed_at, status, diagnosis, doctor_summary, doctor_recommendations, notes, video_room_url')
          .eq('doctor_id', user.id)
          .order('started_at', { ascending: false }),
        supabase
          .from('doctor_profiles')
          .select('consultation_fee')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('chat_sessions')
          .select('id, participant1_id, participant2_id, status')
          .or(`participant1_id.eq.${user.id},participant2_id.eq.${user.id}`)
          .eq('status', 'active'),
      ]);

      // Antes solo se avisaba si fallaban LAS DOS: si caía solo `appointments`
      // (RLS, red…) la pantalla decía «no hay consultas» y el médico podía creer
      // que no tiene citas. Ahora cualquier fallo se ve.
      if (apptRes.error || consRes.error) throw (apptRes.error || consRes.error);

      const appts = (apptRes.data as any[]) || [];
      const cons = (consRes.data as any[]) || [];
      setConsultationFee(Number((feeRes.data as any)?.consultation_fee) || 0);

      // Pacientes con conversación abierta → es lo que convierte una consulta
      // ya atendida en "seguimiento".
      const openChatBy = new Map<string, string>();
      ((chatRes.data as any[]) || []).forEach(s => {
        const other = s.participant1_id === user.id ? s.participant2_id : s.participant1_id;
        openChatBy.set(other, s.id);
      });

      const patientIds = [...new Set([...appts.map(a => a.patient_id), ...cons.map(c => c.patient_id)])].filter(Boolean);

      // Enriquecido en paralelo: nombres, recetas, documentos y valoraciones.
      const consultationIds = cons.map(c => c.id);
      const [profRes, presRes, vaultRes, ratingRes] = await Promise.all([
        patientIds.length
          ? supabase.from('profiles').select('id, name, avatar_url').in('id', patientIds)
          : Promise.resolve({ data: [] as any[] } as any),
        patientIds.length
          ? supabase.from('prescriptions').select('patient_id, consultation_id, created_at').eq('doctor_id', user.id).in('patient_id', patientIds)
          : Promise.resolve({ data: [] as any[] } as any),
        supabase.from('vault_access').select('file_id, consultation_id').eq('doctor_id', user.id),
        consultationIds.length
          ? supabase.from('consultation_ratings').select('consultation_id, rating').eq('doctor_id', user.id).in('consultation_id', consultationIds)
          : Promise.resolve({ data: [] as any[] } as any),
      ]);

      const profMap = new Map<string, any>();
      ((profRes.data as any[]) || []).forEach(p => profMap.set(p.id, p));

      // Las recetas se guardan la fecha: una receta ANTERIOR a la cita no
      // significa que esa cita ya tenga receta. Se guarda la más reciente por
      // paciente y se compara con la fecha de cada consulta.
      const lastPrescriptionByPatient = new Map<string, number>();
      const prescriptionsByConsultation = new Set<string>();
      ((presRes.data as any[]) || []).forEach(p => {
        if (p.patient_id) {
          const ts = p.created_at ? new Date(p.created_at).getTime() : 0;
          lastPrescriptionByPatient.set(p.patient_id, Math.max(lastPrescriptionByPatient.get(p.patient_id) || 0, ts));
        }
        if (p.consultation_id) prescriptionsByConsultation.add(p.consultation_id);
      });
      const prescribedAfter = (patientId: string, sinceIso: string) => {
        const last = lastPrescriptionByPatient.get(patientId);
        if (!last) return false;
        return last >= new Date(sinceIso).getTime();
      };

      // Documentos que CADA paciente ha compartido con este médico.
      // `vault_access` guarda el fichero, no el paciente: hay que resolver el
      // dueño en `vault_files`. Antes se enseñaba el TOTAL del médico en todas
      // las citas, que era un número falso para ese paciente.
      const docsByConsultation = new Map<string, number>();
      const docsByPatient = new Map<string, number>();
      const accessRows = ((vaultRes.data as any[]) || []);
      const fileIds = [...new Set(accessRows.map(v => v.file_id).filter(Boolean))];
      let ownerOfFile = new Map<string, string>();
      if (fileIds.length) {
        const { data: files } = await supabase.from('vault_files').select('id, patient_id').in('id', fileIds);
        ((files as any[]) || []).forEach(f => { if (f.patient_id) ownerOfFile.set(f.id, f.patient_id); });
      }
      accessRows.forEach(v => {
        if (v.consultation_id) docsByConsultation.set(v.consultation_id, (docsByConsultation.get(v.consultation_id) || 0) + 1);
        const owner = ownerOfFile.get(v.file_id);
        // Sin dueño resuelto no se cuenta: mejor 0 que un número inflado.
        if (owner) docsByPatient.set(owner, (docsByPatient.get(owner) || 0) + 1);
      });

      const ratingByConsultation = new Map<string, number>();
      ((ratingRes.data as any[]) || []).forEach(r => ratingByConsultation.set(r.consultation_id, Number(r.rating)));

      const now = Date.now();
      const out: DoctorConsultation[] = [];

      appts.forEach(a => {
        const prof = profMap.get(a.patient_id) || {};
        const start = new Date(a.scheduled_at).getTime();
        const dur = Number(a.duration_minutes) || 30;
        const end = start + dur * 60_000;
        const hasOpenChat = openChatBy.has(a.patient_id);

        let status: ConsultStatus;
        if (a.status === 'cancelled') status = 'cancelled';
        else if (a.status === 'completed') status = hasOpenChat ? 'followUp' : 'completed';
        else if (a.status === 'requested') status = 'requested';
        else if (now >= start && now <= end) status = 'ongoing';
        else if (now > end) status = 'toClose';
        else status = 'confirmed';

        out.push({
          id: a.id,
          kind: 'appointment',
          patientId: a.patient_id,
          patientName: prof.name || '',
          patientAvatar: prof.avatar_url || null,
          at: a.scheduled_at,
          durationMinutes: dur,
          status,
          rawStatus: a.status,
          reason: a.reason || null,
          notes: a.notes || null,
          roomUrl: a.daily_room_url || null,
          cancellationReason: a.cancellation_reason || null,
          chatSessionId: openChatBy.get(a.patient_id) || null,
          hasOpenChat,
          hasPrescription: prescribedAfter(a.patient_id, a.scheduled_at),
          documentsCount: docsByPatient.get(a.patient_id) || 0,
          rating: null,
          summary: null,
          diagnosis: null,
          recommendations: null,
          completedAt: null,
        });
      });

      cons.forEach(c => {
        const prof = profMap.get(c.patient_id) || {};
        const hasOpenChat = openChatBy.has(c.patient_id);
        const done = c.status === 'completed' || !!c.completed_at || !!c.ended_at;
        const status: ConsultStatus = c.status === 'cancelled'
          ? 'cancelled'
          : done
            ? (hasOpenChat ? 'followUp' : 'completed')
            : 'ongoing';

        out.push({
          id: c.id,
          kind: 'chat',
          patientId: c.patient_id,
          patientName: prof.name || '',
          patientAvatar: prof.avatar_url || null,
          at: c.started_at,
          durationMinutes: null,
          status,
          rawStatus: c.status,
          reason: null,
          notes: c.notes || null,
          roomUrl: c.video_room_url || null,
          cancellationReason: null,
          chatSessionId: c.chat_session_id || openChatBy.get(c.patient_id) || null,
          hasOpenChat,
          hasPrescription: prescriptionsByConsultation.has(c.id) || prescribedAfter(c.patient_id, c.started_at),
          documentsCount: docsByConsultation.get(c.id) || docsByPatient.get(c.patient_id) || 0,
          rating: ratingByConsultation.get(c.id) ?? null,
          summary: c.doctor_summary || null,
          diagnosis: c.diagnosis || null,
          recommendations: c.doctor_recommendations || null,
          completedAt: iso(c.completed_at) || iso(c.ended_at),
        });
      });

      out.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      setItems(out);
    } catch (e) {
      console.error('useDoctorConsultations:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [user?.id, role]);

  useEffect(() => { load(); }, [load]);

  return { items, consultationFee, loading, error, refresh: load };
}
