
-- Fix: Sanitize wildcards and add length validation in search_doctors_public
CREATE OR REPLACE FUNCTION public.search_doctors_public(p_term text, p_limit integer DEFAULT 8)
 RETURNS TABLE(user_id uuid, name text, avatar_url text, specialty text, status doctor_status, rating numeric, followers_count integer, location text, bio text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT
    dp.user_id,
    p.name,
    p.avatar_url,
    dp.specialty,
    dp.status,
    dp.rating,
    dp.followers_count,
    dp.location,
    dp.bio
  FROM public.doctor_profiles dp
  JOIN public.profiles p ON p.id = dp.user_id
  WHERE dp.status = 'approved'
    AND (
      p.name ILIKE '%' || replace(replace(left(p_term, 100), '%', '\%'), '_', '\_') || '%' ESCAPE '\'
      OR dp.specialty ILIKE '%' || replace(replace(left(p_term, 100), '%', '\%'), '_', '\_') || '%' ESCAPE '\'
    )
  ORDER BY
    CASE WHEN p.name ILIKE '%' || replace(replace(left(p_term, 100), '%', '\%'), '_', '\_') || '%' ESCAPE '\' THEN 0 ELSE 1 END,
    dp.rating DESC NULLS LAST,
    dp.followers_count DESC NULLS LAST
  LIMIT LEAST(GREATEST(p_limit, 0), 20);
$$;
