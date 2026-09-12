// Cabecera y contadores de la ficha del paciente (/doctor/patients/:patientId), 11-sep-2026.
// rpc doctor_get_patient_overview (migración 20260912): solo con relación real
// médico-paciente; correo y teléfono solo con expediente compartido vigente.
// Sin la migración: `pendingActivation` y la ficha usa lo que la RLS ya permite leer.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isMissingDbObject } from '@/hooks/useCreateAppointment';

const sb = supabase as any;

export interface PatientOverview {
  patient: {
    id: string;
    name: string | null;
    avatar_url: string | null;
    is_identity_verified: boolean;
    email: string | null;
    phone: string | null;
    country_flag: string | null;
    contact_unlocked: boolean;
  };
  counters: {
    consultations: number;
    appointments: number;
    appointments_upcoming: number;
    appointments_pending: number;
    prescriptions: number;
    shared_files: number;
    notes: number;
  };
  last_consultation_at: string | null;
  next_appointment_at: string | null;
  has_active_chat: boolean;
  generated_at: string;
}

export type PatientOverviewStatus = 'loading' | 'ready' | 'pending_activation' | 'no_relation' | 'error';

export function usePatientOverview(patientId?: string) {
  const [overview, setOverview] = useState<PatientOverview | null>(null);
  const [status, setStatus] = useState<PatientOverviewStatus>('loading');

  const load = useCallback(async () => {
    if (!patientId) return;
    setStatus('loading');
    const { data, error } = await sb.rpc('doctor_get_patient_overview', { p_patient_id: patientId });
    if (error) {
      if (isMissingDbObject(error)) {
        setOverview(null);
        setStatus('pending_activation');
        return;
      }
      const msg = `${error.message || ''}`.toLowerCase();
      if (String(error.code) === '42501' || msg.includes('no_patient_relation')) {
        setOverview(null);
        setStatus('no_relation');
        return;
      }
      console.error('[usePatientOverview]', error);
      setStatus('error');
      return;
    }
    setOverview(data as PatientOverview);
    setStatus('ready');
  }, [patientId]);

  useEffect(() => {
    load();
  }, [load]);

  return { overview, status, pendingActivation: status === 'pending_activation', reload: load };
}

export default usePatientOverview;
