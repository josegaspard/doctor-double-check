// Trayectoria pública del médico (estudios, experiencia, certificaciones), 11-sep-2026.
//
// Con la migración 20260912: rpc get_doctor_public_credentials → solo lo APROBADO y
// PUBLICADO (is_public) de un médico aprobado, y sin columnas internas.
// Sin la migración: respaldo a las lecturas actuales filtrando status='approved'
// (lo mismo que ya dejan leer las policies públicas), sin is_public.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isMissingDbObject } from '@/hooks/useCreateAppointment';

const sb = supabase as any;

export interface PublicEducation {
  id: string;
  institution: string;
  degree: string;
  field_of_study: string | null;
  start_year: number | null;
  end_year: number | null;
  description: string | null;
}

export interface PublicExperience {
  id: string;
  title: string;
  organization: string;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean | null;
  description: string | null;
}

export interface PublicCertification {
  id: string;
  name: string;
  issuing_organization: string | null;
  issue_date: string | null;
  expiry_date: string | null;
}

export interface PublicCredentials {
  education: PublicEducation[];
  experience: PublicExperience[];
  certifications: PublicCertification[];
}

const EMPTY: PublicCredentials = { education: [], experience: [], certifications: [] };

export type CredentialTable = 'doctor_education' | 'doctor_experience' | 'doctor_certifications';

export function useDoctorPublicCredentials(doctorId?: string) {
  const [credentials, setCredentials] = useState<PublicCredentials>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [pendingActivation, setPendingActivation] = useState(false);

  const load = useCallback(async () => {
    if (!doctorId) return;
    setLoading(true);
    const { data, error } = await sb.rpc('get_doctor_public_credentials', { p_doctor_id: doctorId });
    if (!error) {
      setPendingActivation(false);
      setCredentials((data as PublicCredentials) || EMPTY);
      setLoading(false);
      return;
    }
    if (!isMissingDbObject(error)) console.error('[useDoctorPublicCredentials]', error);
    setPendingActivation(isMissingDbObject(error));

    // Respaldo: solo lo aprobado, con las columnas públicas.
    const [edu, exp, cert] = await Promise.all([
      sb.from('doctor_education').select('id, institution, degree, field_of_study, start_year, end_year, description').eq('doctor_id', doctorId).eq('status', 'approved').order('end_year', { ascending: false, nullsFirst: false }),
      sb.from('doctor_experience').select('id, title, organization, location, start_date, end_date, is_current, description').eq('doctor_id', doctorId).eq('status', 'approved').order('start_date', { ascending: false, nullsFirst: false }),
      sb.from('doctor_certifications').select('id, name, issuing_organization, issue_date, expiry_date').eq('doctor_id', doctorId).eq('status', 'approved').order('issue_date', { ascending: false, nullsFirst: false }),
    ]);
    setCredentials({ education: edu.data || [], experience: exp.data || [], certifications: cert.data || [] });
    setLoading(false);
  }, [doctorId]);

  useEffect(() => {
    load();
  }, [load]);

  return { credentials, loading, pendingActivation, reload: load };
}

/** El propio médico decide si una credencial suya sale en su perfil público. */
export async function setCredentialVisibility(
  table: CredentialTable,
  id: string,
  isPublic: boolean,
): Promise<{ ok: true } | { ok: false; reason: 'pending_activation' | 'error'; error?: any }> {
  const { error } = await sb.from(table).update({ is_public: isPublic }).eq('id', id);
  if (!error) return { ok: true };
  // 42703 = la columna is_public todavía no existe.
  if (isMissingDbObject(error) || String(error.code) === '42703' || String(error.code) === 'PGRST204') {
    return { ok: false, reason: 'pending_activation', error };
  }
  console.error('[setCredentialVisibility]', error);
  return { ok: false, reason: 'error', error };
}

export default useDoctorPublicCredentials;
