DROP FUNCTION IF EXISTS public.get_doctor_public_profile(uuid);

CREATE OR REPLACE FUNCTION public.get_doctor_public_profile(p_user_id uuid)
 RETURNS TABLE(user_id uuid, profile_id uuid, name text, avatar_url text, specialty text, status doctor_status, rating numeric, total_consultations integer, consultation_fee numeric, followers_count integer, location text, bio text, office_hours_start time without time zone, office_hours_end time without time zone, office_days text[], country_code text, country_flag text)
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
    p.country_flag
  FROM public.doctor_profiles dp
  JOIN public.profiles p ON p.id = dp.user_id
  WHERE dp.user_id = p_user_id
    AND dp.status = 'approved'
  LIMIT 1;
$function$;