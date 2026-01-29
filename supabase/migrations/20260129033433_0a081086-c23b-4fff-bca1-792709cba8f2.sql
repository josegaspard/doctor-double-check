-- Make public discovery views run with view owner's privileges so they can safely expose
-- a limited column set without requiring broad SELECT policies on the underlying tables.
-- This fixes global search returning empty results for authenticated patients.

ALTER VIEW public.profiles_public SET (security_invoker = false);
ALTER VIEW public.doctor_profiles_public SET (security_invoker = false);
ALTER VIEW public.resident_profiles_public SET (security_invoker = false);

-- Ensure discovery views are readable by both anonymous and authenticated users
GRANT SELECT ON public.profiles_public TO anon, authenticated;
GRANT SELECT ON public.doctor_profiles_public TO anon, authenticated;
GRANT SELECT ON public.resident_profiles_public TO anon, authenticated;

-- Ensure schema usage is granted (needed for some clients)
GRANT USAGE ON SCHEMA public TO anon, authenticated;