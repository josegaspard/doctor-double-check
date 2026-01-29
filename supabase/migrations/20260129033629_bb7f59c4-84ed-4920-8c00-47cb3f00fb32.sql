-- Revert views to security_invoker=on to satisfy security linter
ALTER VIEW public.profiles_public SET (security_invoker = true);
ALTER VIEW public.doctor_profiles_public SET (security_invoker = true);
ALTER VIEW public.resident_profiles_public SET (security_invoker = true);

-- Keep grants (harmless if already present)
GRANT SELECT ON public.profiles_public TO anon, authenticated;
GRANT SELECT ON public.doctor_profiles_public TO anon, authenticated;
GRANT SELECT ON public.resident_profiles_public TO anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Create a safe, public search function that returns ONLY non-sensitive doctor fields.
-- This avoids opening up SELECT on doctor_profiles (which contains private fields like license).
CREATE OR REPLACE FUNCTION public.search_doctors_public(p_term text, p_limit int DEFAULT 8)
RETURNS TABLE (
  user_id uuid,
  name text,
  avatar_url text,
  specialty text,
  status public.doctor_status,
  rating numeric,
  followers_count integer,
  location text,
  bio text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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
      p.name ILIKE '%' || p_term || '%'
      OR dp.specialty ILIKE '%' || p_term || '%'
    )
  ORDER BY
    -- Prefer name matches over specialty matches
    CASE WHEN p.name ILIKE '%' || p_term || '%' THEN 0 ELSE 1 END,
    dp.rating DESC NULLS LAST,
    dp.followers_count DESC NULLS LAST
  LIMIT LEAST(GREATEST(p_limit, 0), 20);
$$;

GRANT EXECUTE ON FUNCTION public.search_doctors_public(text, int) TO anon, authenticated;