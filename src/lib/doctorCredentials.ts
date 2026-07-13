import { supabase } from '@/integrations/supabase/client';

// Credenciales completas del médico que deben aparecer en el membrete de la receta.
// Se leen en vivo desde doctor_profiles (son datos estáticos: universidad, hospital,
// cédulas), de modo que las recetas —incluidas las ya emitidas— siempre muestran el
// membrete completo sin depender de un snapshot en la tabla prescriptions.
export interface DoctorCredentials {
  doctorSpecialty?: string;
  doctorLicense?: string;
  doctorCedula?: string;
  doctorNumeroConsejo?: string;
  doctorUniversity?: string;
  doctorHospital?: string;
  doctorCofepris?: string;
  doctorSignatureUrl?: string;
}

// Los "lugares de práctica" (workplaces) se guardan como arreglo de objetos { name }
// o, en datos antiguos, de strings. Devolvemos los nombres unidos con " · ".
const joinWorkplaces = (raw: any): string | undefined => {
  if (!Array.isArray(raw)) return undefined;
  const names = raw
    .map((w) => (typeof w === 'string' ? w : w?.name))
    .map((n) => (typeof n === 'string' ? n.trim() : ''))
    .filter(Boolean);
  return names.length ? names.join(' · ') : undefined;
};

const joinSpecialties = (main?: string, secondary?: any): string | undefined => {
  const extra = Array.isArray(secondary)
    ? secondary.map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean)
    : [];
  const all = [main?.trim(), ...extra].filter(Boolean);
  return all.length ? all.join(' · ') : undefined;
};

const mapRow = (d: any): DoctorCredentials => ({
  // Especialidad principal + secundarias (todos los datos del médico).
  doctorSpecialty: joinSpecialties(d.specialty, d.secondary_specialties),
  doctorLicense: d.license || undefined,
  doctorCedula: d.cedula_profesional || undefined,
  // Céd. de especialidad / No. de Consejo: campo nuevo con fallback al legacy.
  doctorNumeroConsejo: d.cedula_especialidad || d.numero_consejo || undefined,
  doctorUniversity: d.university || undefined,
  // Afiliación hospitalaria: workplaces (nuevo) con fallback a practice_hospital.
  doctorHospital: joinWorkplaces(d.workplaces) || d.practice_hospital || undefined,
  doctorCofepris: d.cofepris_permit || undefined,
  doctorSignatureUrl: d.signature_url || undefined,
});

export const fetchDoctorCredentials = async (userId?: string): Promise<DoctorCredentials> => {
  if (!userId) return {};

  let creds: DoctorCredentials = {};

  // Membrete: RPC SECURITY DEFINER, para que también los PACIENTES (que no pueden
  // leer doctor_profiles por RLS) obtengan las credenciales completas al descargar.
  // (types.ts aún no lista la RPC → cast a any, ver GOTCHA de tipos generados.)
  try {
    const { data, error } = await (supabase as any)
      .rpc('get_doctor_prescription_credentials', { p_doctor_user_id: userId });
    const row = Array.isArray(data) ? data[0] : data;
    if (!error && row) creds = mapRow(row);
  } catch { /* si la RPC aún no está desplegada, caemos al select directo abajo */ }

  // Si la RPC no devolvió nada (p. ej. aún no desplegada), fallback a lectura directa
  // (funciona cuando quien descarga es el propio médico, dueño del perfil).
  if (!creds.doctorSpecialty && !creds.doctorCedula && !creds.doctorUniversity) {
    try {
      const { data } = await supabase
        .from('doctor_profiles')
        .select('specialty, secondary_specialties, license, cedula_profesional, cedula_especialidad, numero_consejo, university, workplaces, practice_hospital, cofepris_permit, signature_url')
        .eq('user_id', userId)
        .maybeSingle();
      if (data) creds = { ...mapRow(data), ...creds };
    } catch { /* RLS puede bloquear a pacientes; el membrete cae al snapshot de la receta */ }
  }

  // Firma: RPC dedicada (SECURITY DEFINER) accesible también a pacientes.
  // La RPC de credenciales NO expone signature_url a propósito.
  if (!creds.doctorSignatureUrl) {
    try {
      const { data: sig } = await supabase
        .rpc('get_doctor_signature', { p_doctor_user_id: userId });
      if (sig) creds.doctorSignatureUrl = sig as string;
    } catch { /* la firma es best-effort para el PDF */ }
  }

  return creds;
};
