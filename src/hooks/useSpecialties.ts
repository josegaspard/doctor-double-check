import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SPECIALTIES_FILTER } from '@/lib/specialties';

// Admin-extendable specialties: the hardcoded list in src/lib/specialties.ts is
// the default; the admin can append extras via site_settings.extra_specialties
// (a string array) without a code deploy. Returns merged values.
let cachedExtra: string[] | null = null;

// Base specialty values (strings), excluding the "Todas" filter sentinel.
const BASE_VALUES = SPECIALTIES_FILTER.filter((s) => s.value !== 'Todas').map((s) => s.value);

export function useSpecialties() {
  const [extra, setExtra] = useState<string[]>(cachedExtra || []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('site_settings')
          .select('value')
          .eq('id', 'extra_specialties')
          .maybeSingle();
        const arr = Array.isArray(data?.value)
          ? (data!.value as unknown[]).filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
          : [];
        cachedExtra = arr;
        if (active) setExtra(arr);
      } catch {
        if (active) setExtra([]);
      }
    })();
    return () => { active = false; };
  }, []);

  // Dedupe extras that already exist in the base list.
  // Set<string> explícito: BASE_VALUES es una unión literal del enum generado y los
  // extras vienen de la BD como string — sin el widening, .has/.add/.push marcan TS2345.
  const specialtyValues = useMemo(() => {
    const seen = new Set<string>(BASE_VALUES);
    const merged: string[] = [...BASE_VALUES];
    for (const e of extra) { if (!seen.has(e)) { seen.add(e); merged.push(e); } }
    return merged;
  }, [extra]);

  // For selection dropdowns: includes the trailing "Otra especialidad".
  const specialtiesList = useMemo(() => [...specialtyValues, 'Otra especialidad'], [specialtyValues]);

  return { specialtyValues, specialtiesList };
}
