-- FILTROS por doctor en contenido premium y lives (cliente 15-jul-2026):
-- país, especialidad, universidad, hospital.
--
-- Las columnas ya existen en doctor_profiles (country, university,
-- practice_hospital — verificado en prod), pero la vista doctor_profiles_public
-- tiene security_invoker=true y la RLS de doctor_profiles es "owner or admin
-- only" → los usuarios públicos leen 0 filas. El patrón del repo para catálogo
-- público es RPC SECURITY DEFINER (igual que get_doctors_paginated). Este RPC
-- devuelve SOLO datos de membrete no sensibles de doctores APROBADOS.
CREATE OR REPLACE FUNCTION public.get_doctor_filter_fields(p_user_ids uuid[])
RETURNS TABLE (
  user_id uuid,
  specialty text,
  university text,
  practice_hospital text,
  country text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT dp.user_id, dp.specialty, dp.university, dp.practice_hospital, dp.country
  FROM public.doctor_profiles dp
  WHERE dp.status = 'approved'
    AND dp.user_id = ANY(p_user_ids)
$$;

REVOKE ALL ON FUNCTION public.get_doctor_filter_fields(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.get_doctor_filter_fields(uuid[]) TO anon, authenticated;
