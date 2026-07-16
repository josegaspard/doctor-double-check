-- Opciones GLOBALES de filtros (país / especialidad / universidad / hospital)
-- para poblar los dropdowns SIEMPRE, aunque en ese momento no haya lives activos
-- ni grabaciones de ese doctor. Devuelve valores distintos de TODOS los doctores
-- aprobados. SECURITY DEFINER porque doctor_profiles tiene RLS owner-only.
CREATE OR REPLACE FUNCTION public.get_doctor_filter_options()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'countries',    (SELECT COALESCE(jsonb_agg(v ORDER BY v), '[]'::jsonb) FROM (SELECT DISTINCT NULLIF(TRIM(country), '') AS v FROM public.doctor_profiles WHERE status='approved' AND NULLIF(TRIM(country),'') IS NOT NULL) t),
    'specialties',  (SELECT COALESCE(jsonb_agg(v ORDER BY v), '[]'::jsonb) FROM (SELECT DISTINCT NULLIF(TRIM(specialty), '') AS v FROM public.doctor_profiles WHERE status='approved' AND NULLIF(TRIM(specialty),'') IS NOT NULL) t),
    'universities', (SELECT COALESCE(jsonb_agg(v ORDER BY v), '[]'::jsonb) FROM (SELECT DISTINCT NULLIF(TRIM(university), '') AS v FROM public.doctor_profiles WHERE status='approved' AND NULLIF(TRIM(university),'') IS NOT NULL) t),
    'hospitals',    (SELECT COALESCE(jsonb_agg(v ORDER BY v), '[]'::jsonb) FROM (SELECT DISTINCT NULLIF(TRIM(practice_hospital), '') AS v FROM public.doctor_profiles WHERE status='approved' AND NULLIF(TRIM(practice_hospital),'') IS NOT NULL) t)
  );
$$;

REVOKE ALL ON FUNCTION public.get_doctor_filter_options() FROM public;
GRANT EXECUTE ON FUNCTION public.get_doctor_filter_options() TO anon, authenticated;
