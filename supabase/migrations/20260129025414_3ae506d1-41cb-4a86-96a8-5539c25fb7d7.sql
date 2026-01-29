
-- Grant SELECT permissions on public views to authenticated and anon users
GRANT SELECT ON public.profiles_public TO authenticated;
GRANT SELECT ON public.profiles_public TO anon;

GRANT SELECT ON public.doctor_profiles_public TO authenticated;
GRANT SELECT ON public.doctor_profiles_public TO anon;

GRANT SELECT ON public.resident_profiles_public TO authenticated;
GRANT SELECT ON public.resident_profiles_public TO anon;
