DROP VIEW IF EXISTS public.doctor_profiles_public CASCADE;

CREATE VIEW public.doctor_profiles_public
WITH (security_invoker = on) AS
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
  dp.available_for_clinical_sessions,
  dp.badge_override,
  dp.rank_override,
  dp.office_hours_start,
  dp.office_hours_end,
  dp.office_days,
  dp.signature_url,
  dp.cedula_profesional,
  dp.cofepris_permit,
  dp.status,
  dp.created_at,
  dp.updated_at
FROM public.doctor_profiles dp
WHERE dp.status = 'approved';

GRANT SELECT ON public.doctor_profiles_public TO anon, authenticated;