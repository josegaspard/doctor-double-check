import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DoctorFilterFields {
  specialty?: string | null;
  university?: string | null;
  practiceHospital?: string | null;
  country?: string | null;
}

/**
 * Campos de membrete del doctor para FILTROS públicos (país, universidad,
 * hospital) en contenido premium y lives. Vía RPC SECURITY DEFINER
 * get_doctor_filter_fields (la vista doctor_profiles_public está bloqueada por
 * RLS para usuarios públicos). Devuelve un mapa doctorId → campos.
 */
export function useDoctorFilterFields(doctorIds: string[]) {
  const [fields, setFields] = useState<Record<string, DoctorFilterFields>>({});

  // Clave estable para no re-consultar en cada render.
  const idsKey = useMemo(() => [...new Set(doctorIds)].sort().join(','), [doctorIds]);

  useEffect(() => {
    const ids = idsKey ? idsKey.split(',') : [];
    if (ids.length === 0) { setFields({}); return; }
    let active = true;
    (async () => {
      try {
        const { data, error } = await (supabase as any).rpc('get_doctor_filter_fields', { p_user_ids: ids });
        if (error) throw error;
        if (!active) return;
        const map: Record<string, DoctorFilterFields> = {};
        for (const row of (data || []) as any[]) {
          map[row.user_id] = {
            specialty: row.specialty,
            university: row.university,
            practiceHospital: row.practice_hospital,
            country: row.country,
          };
        }
        setFields(map);
      } catch (e) {
        console.error('get_doctor_filter_fields error', e);
      }
    })();
    return () => { active = false; };
  }, [idsKey]);

  return fields;
}

// Opciones únicas (ordenadas) para un dropdown a partir del mapa de campos.
export function uniqueFieldOptions(
  fields: Record<string, DoctorFilterFields>,
  key: keyof DoctorFilterFields,
): string[] {
  return [...new Set(Object.values(fields).map((f) => (f[key] || '').trim()).filter(Boolean))].sort();
}

export interface DoctorFilterOptions {
  countries: string[];
  specialties: string[];
  universities: string[];
  hospitals: string[];
}

/**
 * Opciones GLOBALES de filtros (país/especialidad/universidad/hospital) de TODOS
 * los doctores aprobados, para poblar los dropdowns SIEMPRE (aunque ahora no haya
 * lives ni grabaciones de ese doctor). Vía RPC get_doctor_filter_options.
 */
export function useDoctorFilterOptions(): DoctorFilterOptions {
  const [opts, setOpts] = useState<DoctorFilterOptions>({ countries: [], specialties: [], universities: [], hospitals: [] });
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data, error } = await (supabase as any).rpc('get_doctor_filter_options');
        if (error) throw error;
        if (active && data) {
          setOpts({
            countries: data.countries || [],
            specialties: data.specialties || [],
            universities: data.universities || [],
            hospitals: data.hospitals || [],
          });
        }
      } catch (e) {
        console.error('get_doctor_filter_options error', e);
      }
    })();
    return () => { active = false; };
  }, []);
  return opts;
}
