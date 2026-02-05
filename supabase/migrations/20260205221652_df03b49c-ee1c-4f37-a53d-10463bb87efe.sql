
-- 1. Drop the overly permissive RLS policy on doctor_profiles that exposes sensitive data
DROP POLICY IF EXISTS "Public can view limited approved doctor data" ON public.doctor_profiles;

-- 2. Drop the permissive storage policy on doctor-content that bypasses paid access controls
DROP POLICY IF EXISTS "Public doctor content is accessible" ON storage.objects;

-- 3. Recreate doctor_profiles_public view WITH security_invoker = true
DROP VIEW IF EXISTS public.doctor_profiles_public;
CREATE VIEW public.doctor_profiles_public
WITH (security_invoker = true)
AS
SELECT
  id,
  user_id,
  specialty,
  bio,
  location,
  rating,
  total_consultations,
  followers_count,
  available_for_double_check,
  available_for_clinical_sessions,
  consultation_fee,
  office_hours_start,
  office_hours_end,
  office_days,
  status,
  created_at,
  updated_at
FROM public.doctor_profiles
WHERE status = 'approved';
