-- Distintivos manuales de médicos (cliente 2026-06-29).
-- El super-admin asigna MANUALMENTE al verificar el perfil:
--   'gold'     = 🥇 medalla dorada  (especialista con trayectoria)
--   'verified' = ✔️ palomita        (líder de opinión / influencer)
--   null       = sin distintivo
-- No es automático: es independiente de doctor_ranks (rank_override) y del
-- badge_override legacy ('pro'/'new').

alter table public.doctor_profiles
  add column if not exists manual_badge text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'doctor_profiles_manual_badge_check'
  ) then
    alter table public.doctor_profiles
      add constraint doctor_profiles_manual_badge_check
      check (manual_badge in ('gold','verified'));
  end if;
end $$;

comment on column public.doctor_profiles.manual_badge is
  'Distintivo manual asignado por admin: gold=medalla dorada, verified=palomita, null=ninguno (cliente 2026-06-29)';

-- Exponer manual_badge en el perfil público del doctor para mostrar el distintivo
-- (medalla/palomita) a quien visita el perfil. Recreamos la función agregando la
-- columna manual_badge al final del RETURNS TABLE (cambio de tipo → DROP + CREATE).
DROP FUNCTION IF EXISTS public.get_doctor_public_profile(uuid);

CREATE FUNCTION public.get_doctor_public_profile(p_user_id uuid)
 RETURNS TABLE(user_id uuid, profile_id uuid, name text, avatar_url text, specialty text, status doctor_status, rating numeric, total_consultations integer, consultation_fee numeric, followers_count integer, location text, bio text, office_hours_start time without time zone, office_hours_end time without time zone, office_days text[], country_code text, country_flag text, is_identity_verified boolean, manual_badge text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    dp.user_id,
    dp.id as profile_id,
    p.name,
    p.avatar_url,
    dp.specialty,
    dp.status,
    dp.rating,
    dp.total_consultations,
    dp.consultation_fee,
    dp.followers_count,
    dp.location,
    dp.bio,
    dp.office_hours_start,
    dp.office_hours_end,
    dp.office_days,
    p.country_code,
    p.country_flag,
    COALESCE(p.is_identity_verified, false) as is_identity_verified,
    dp.manual_badge
  FROM public.doctor_profiles dp
  JOIN public.profiles p ON p.id = dp.user_id
  WHERE dp.user_id = p_user_id
    AND dp.status = 'approved'
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.get_doctor_public_profile(uuid) TO anon, authenticated;
