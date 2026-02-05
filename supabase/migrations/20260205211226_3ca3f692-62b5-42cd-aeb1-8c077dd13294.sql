
-- Drop the existing view and recreate with consultation_fee included
DROP VIEW IF EXISTS public.doctor_profiles_public;

CREATE VIEW public.doctor_profiles_public AS
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
