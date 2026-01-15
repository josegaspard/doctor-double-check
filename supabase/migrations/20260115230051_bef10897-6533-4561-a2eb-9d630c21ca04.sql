-- =====================================================
-- FIX SECURITY DEFINER VIEWS
-- Add security_invoker=on to all views
-- =====================================================

-- 1. Drop and recreate profiles_public with security_invoker
DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public
WITH (security_invoker=on) AS
SELECT 
  id,
  name,
  avatar_url,
  is_identity_verified,
  created_at,
  updated_at
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- 2. Drop and recreate doctor_profiles_public with security_invoker
DROP VIEW IF EXISTS public.doctor_profiles_public;

CREATE VIEW public.doctor_profiles_public
WITH (security_invoker=on) AS
SELECT 
  id,
  user_id,
  specialty,
  bio,
  consultation_fee,
  rating,
  total_consultations,
  followers_count,
  available_for_double_check,
  available_for_clinical_sessions,
  location,
  status,
  created_at,
  updated_at
FROM public.doctor_profiles;

GRANT SELECT ON public.doctor_profiles_public TO anon, authenticated;

-- 3. Drop and recreate resident_profiles_public with security_invoker
DROP VIEW IF EXISTS public.resident_profiles_public;

CREATE VIEW public.resident_profiles_public
WITH (security_invoker=on) AS
SELECT 
  id,
  user_id,
  institution,
  specialty,
  year,
  status,
  followers_count,
  created_at,
  updated_at
FROM public.resident_profiles;

GRANT SELECT ON public.resident_profiles_public TO anon, authenticated;

-- 4. Fix the old public_profiles view that had no policies
DROP VIEW IF EXISTS public.public_profiles;