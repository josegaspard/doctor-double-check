
-- Fix the doctor_profiles_public view to use SECURITY INVOKER (default, but explicit)
DROP VIEW IF EXISTS public.doctor_profiles_public;
CREATE VIEW public.doctor_profiles_public 
WITH (security_invoker = true) AS
  SELECT 
    user_id, id, specialty, bio, rating, total_consultations,
    followers_count, consultation_fee, available_for_double_check,
    available_for_clinical_sessions, location, office_hours_start,
    office_hours_end, office_days, status, created_at, updated_at,
    badge_override
  FROM public.doctor_profiles
  WHERE status = 'approved';

-- Grant select to anon and authenticated
GRANT SELECT ON public.doctor_profiles_public TO anon, authenticated;
