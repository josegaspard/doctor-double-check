-- 1. Drop existing public views to recreate them with security
DROP VIEW IF EXISTS public.doctor_profiles_public;
DROP VIEW IF EXISTS public.resident_profiles_public;

-- 2. Recreate doctor_profiles_public view WITHOUT sensitive credential columns
CREATE VIEW public.doctor_profiles_public
WITH (security_invoker=on) AS
SELECT 
    id,
    user_id,
    specialty,
    bio,
    location,
    consultation_fee,
    rating,
    total_consultations,
    followers_count,
    available_for_double_check,
    available_for_clinical_sessions,
    status,
    created_at,
    updated_at
    -- EXCLUDED: license, cedula_profesional, numero_consejo (sensitive government IDs)
FROM public.doctor_profiles;

-- 3. Recreate resident_profiles_public view WITHOUT sensitive credential columns
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
    -- EXCLUDED: titulo_medicina, cedula_profesional (sensitive credentials)
FROM public.resident_profiles;

-- 4. Update doctor_profiles RLS policy to restrict credential access
DROP POLICY IF EXISTS "Doctor profiles are viewable by everyone" ON public.doctor_profiles;

-- Only admins and the doctor themselves can see sensitive credentials
CREATE POLICY "Doctor profiles public info viewable by everyone"
ON public.doctor_profiles FOR SELECT
USING (
    -- Everyone can see non-sensitive fields (handled via public view)
    -- Direct table access shows credentials only to owner or admin
    auth.uid() = user_id 
    OR has_role(auth.uid(), 'admin')
);

-- 5. Update resident_profiles RLS policy similarly  
DROP POLICY IF EXISTS "Resident profiles are viewable by everyone" ON public.resident_profiles;

CREATE POLICY "Resident profiles public info viewable by everyone"
ON public.resident_profiles FOR SELECT
USING (
    -- Direct table access only for owner or admin
    auth.uid() = user_id 
    OR has_role(auth.uid(), 'admin')
);

-- 6. Grant SELECT on public views to authenticated and anon users
GRANT SELECT ON public.doctor_profiles_public TO authenticated, anon;
GRANT SELECT ON public.resident_profiles_public TO authenticated, anon;