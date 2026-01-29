-- Create a SECURITY DEFINER function to get a single doctor's public profile
-- This allows patients to view doctor profiles without RLS restrictions
CREATE OR REPLACE FUNCTION public.get_doctor_public_profile(p_user_id uuid)
RETURNS TABLE (
  user_id uuid,
  profile_id uuid,
  name text,
  avatar_url text,
  specialty text,
  status doctor_status,
  rating numeric,
  total_consultations integer,
  consultation_fee numeric,
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
    dp.bio
  FROM public.doctor_profiles dp
  JOIN public.profiles p ON p.id = dp.user_id
  WHERE dp.user_id = p_user_id
    AND dp.status = 'approved'
  LIMIT 1;
$$;

-- Grant execute permissions to both anonymous and authenticated users
GRANT EXECUTE ON FUNCTION public.get_doctor_public_profile(uuid) TO anon, authenticated;