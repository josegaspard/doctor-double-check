
CREATE OR REPLACE FUNCTION public.get_doctors_paginated(p_page integer DEFAULT 1, p_page_size integer DEFAULT 20, p_search text DEFAULT ''::text, p_specialty text DEFAULT ''::text, p_location text DEFAULT ''::text)
 RETURNS TABLE(id uuid, user_id uuid, specialty text, bio text, rating numeric, followers_count integer, consultation_fee numeric, total_consultations integer, location text, available_for_double_check boolean, badge_override text, office_hours_start time without time zone, office_hours_end time without time zone, office_days text[], name text, avatar_url text, is_identity_verified boolean, total_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH filtered AS (
    SELECT
      dp.id,
      dp.user_id,
      dp.specialty,
      dp.bio,
      dp.rating,
      dp.followers_count,
      dp.consultation_fee,
      dp.total_consultations,
      dp.location,
      dp.available_for_double_check,
      dp.badge_override,
      dp.office_hours_start,
      dp.office_hours_end,
      dp.office_days,
      p.name,
      p.avatar_url,
      p.is_identity_verified
    FROM public.doctor_profiles dp
    JOIN public.profiles p ON p.id = dp.user_id
    WHERE dp.status = 'approved'
      AND (
        p_search = '' OR
        p.name ILIKE '%' || replace(replace(left(p_search, 100), '%', '\%'), '_', '\_') || '%' ESCAPE '\'
        OR dp.specialty ILIKE '%' || replace(replace(left(p_search, 100), '%', '\%'), '_', '\_') || '%' ESCAPE '\'
      )
      AND (
        p_specialty = '' OR p_specialty = 'Todas' OR dp.specialty = p_specialty
      )
      AND (
        p_location = '' OR dp.location ILIKE '%' || replace(replace(left(p_location, 100), '%', '\%'), '_', '\_') || '%' ESCAPE '\'
      )
  ),
  cnt AS (
    SELECT count(*) AS total_count FROM filtered
  )
  SELECT
    f.id, f.user_id, f.specialty, f.bio, f.rating, f.followers_count,
    f.consultation_fee, f.total_consultations, f.location,
    f.available_for_double_check, f.badge_override,
    f.office_hours_start, f.office_hours_end, f.office_days,
    f.name, f.avatar_url, f.is_identity_verified,
    cnt.total_count
  FROM filtered f, cnt
  ORDER BY f.rating DESC NULLS LAST, f.followers_count DESC NULLS LAST, f.id
  LIMIT LEAST(p_page_size, 20)
  OFFSET (GREATEST(p_page, 1) - 1) * LEAST(p_page_size, 20);
$function$;
