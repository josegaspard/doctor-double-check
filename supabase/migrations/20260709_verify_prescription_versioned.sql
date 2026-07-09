-- Versiona la RPC pública `verify_prescription` que existía SOLO en la BD de
-- producción (drift no versionado): un `db reset` / entorno nuevo la perdería y la
-- página pública de verificación por QR se caería.
--
-- Definición EXACTA extraída de prod el 2026-07-09 vía
--   SELECT pg_get_functiondef('public.verify_prescription(uuid)'::regprocedure);
-- Notas de diseño (no cambiar sin razón):
--  * El nombre del paciente se ENMASCARA (inicial + '**' por palabra) — es una
--    página pública; nunca exponer el nombre completo.
--  * La verificación de cédula se cruza con cedula_number = doctor_cedula de la
--    receta (no cualquier cédula verificada del doctor).
CREATE OR REPLACE FUNCTION public.verify_prescription(p_id uuid)
 RETURNS TABLE(id uuid, doctor_name text, doctor_specialty text, doctor_license text, doctor_cedula text, cedula_verified boolean, cedula_institucion text, cedula_anio integer, patient_name text, patient_age text, medications jsonb, signed_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    p.id, p.doctor_name, p.doctor_specialty, p.doctor_license, p.doctor_cedula,
    coalesce(cv.is_verified, false) as cedula_verified,
    cv.institucion as cedula_institucion,
    cv.anio_registro as cedula_anio,
    coalesce((
      select string_agg(left(word, 1) || '**', ' ')
      from unnest(regexp_split_to_array(coalesce(p.patient_name, ''), '\s+')) as word
      where word <> ''
    ), '—') as patient_name,
    p.patient_age, p.medications::jsonb, p.signed_at
  from public.prescriptions p
  left join lateral (
    select v.is_verified, v.institucion, v.anio_registro
    from public.cedula_verifications v
    where v.user_id = p.doctor_id and v.is_verified = true
      and (p.doctor_cedula is null or v.cedula_number = p.doctor_cedula)
    order by v.verified_at desc nulls last
    limit 1
  ) cv on true
  where p.id = p_id
$function$;

-- Pública (la verifican pacientes sin login vía QR) + autenticados.
REVOKE ALL ON FUNCTION public.verify_prescription(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.verify_prescription(uuid) TO anon, authenticated;
