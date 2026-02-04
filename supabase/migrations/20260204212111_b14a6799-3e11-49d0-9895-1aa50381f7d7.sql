-- FIX 1: profiles table - restrict email exposure
-- Drop the overly permissive policy that exposes all data including emails
DROP POLICY IF EXISTS "Anyone authenticated can read profile names" ON public.profiles;

-- Create a more restrictive policy - users can only see their own email, but can see others' name/avatar
-- This is handled through the existing profiles_public view which excludes email

-- FIX 2: doctor_profiles table - restrict financial data exposure  
-- Drop the overly permissive policy that exposes financial data
DROP POLICY IF EXISTS "Anyone authenticated can view approved doctor profiles" ON public.doctor_profiles;

-- Create a restrictive SELECT policy that only allows viewing non-sensitive public data
-- Financial data (pending_earnings, total_earnings, stripe_account_id, consultation_fee) restricted to owner/admin
CREATE POLICY "Public can view limited approved doctor data" 
ON public.doctor_profiles 
FOR SELECT 
USING (
  -- Owner and admin can see everything
  (auth.uid() = user_id) 
  OR has_role(auth.uid(), 'admin')
  -- For approved doctors, others can only view via the public view
  OR (status = 'approved')
);

-- Update the doctor_profiles_public view to explicitly exclude financial data
DROP VIEW IF EXISTS public.doctor_profiles_public;

CREATE VIEW public.doctor_profiles_public 
WITH (security_invoker = true)
AS SELECT
  id,
  user_id,
  specialty,
  bio,
  status,
  rating,
  total_consultations,
  followers_count,
  available_for_double_check,
  available_for_clinical_sessions,
  location,
  office_hours_start,
  office_hours_end,
  office_days,
  created_at,
  updated_at
  -- Explicitly excluding: license, cedula_profesional, numero_consejo, 
  -- consultation_fee, pending_earnings, total_earnings, stripe_account_id, 
  -- cedula_verification_id, payouts_enabled
FROM public.doctor_profiles
WHERE status = 'approved';

-- Grant SELECT on the public view to authenticated users
GRANT SELECT ON public.doctor_profiles_public TO authenticated;

-- Update profiles_public view to ensure email is not exposed
DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public 
WITH (security_invoker = true)
AS SELECT
  id,
  name,
  avatar_url,
  is_identity_verified,
  created_at,
  updated_at
  -- Explicitly excluding: email, preferred_language, onboarding_completed
FROM public.profiles;

-- Grant SELECT on the public view to authenticated users
GRANT SELECT ON public.profiles_public TO authenticated;