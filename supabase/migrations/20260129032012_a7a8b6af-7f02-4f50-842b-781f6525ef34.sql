-- Grant read access to public discovery views for search/doctor discovery
-- These views are explicitly designed to expose only non-sensitive fields.
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON TABLE public.profiles_public TO anon, authenticated;
GRANT SELECT ON TABLE public.doctor_profiles_public TO anon, authenticated;
GRANT SELECT ON TABLE public.resident_profiles_public TO anon, authenticated;