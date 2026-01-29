-- ============================================
-- SECURITY FIX: Restrict public views to authenticated users only
-- ============================================

-- 1. Drop existing public views and recreate with authentication requirement
DROP VIEW IF EXISTS public.profiles_public;
DROP VIEW IF EXISTS public.doctor_profiles_public;
DROP VIEW IF EXISTS public.resident_profiles_public;

-- 2. Recreate profiles_public WITHOUT email (only public-safe data)
CREATE VIEW public.profiles_public
WITH (security_invoker = on)
AS SELECT 
    id,
    name,
    avatar_url,
    is_identity_verified,
    created_at,
    updated_at
FROM public.profiles;
-- Note: Email is intentionally excluded to prevent harvesting

-- 3. Recreate doctor_profiles_public WITHOUT financial details
CREATE VIEW public.doctor_profiles_public
WITH (security_invoker = on)
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
    created_at,
    updated_at
    -- Excluded: consultation_fee, pending_earnings, total_earnings, stripe_account_id, payouts_enabled
FROM public.doctor_profiles;

-- 4. Recreate resident_profiles_public with only necessary fields
CREATE VIEW public.resident_profiles_public
WITH (security_invoker = on)
AS SELECT 
    id,
    user_id,
    institution,
    specialty,
    year,
    status,
    followers_count,
    created_at,
    updated_at
    -- Excluded: cedula_profesional, titulo_medicina
FROM public.resident_profiles;

-- 5. Grant access only to authenticated users for these views
GRANT SELECT ON public.profiles_public TO authenticated;
GRANT SELECT ON public.doctor_profiles_public TO authenticated;
GRANT SELECT ON public.resident_profiles_public TO authenticated;

-- Revoke public/anon access
REVOKE ALL ON public.profiles_public FROM anon;
REVOKE ALL ON public.doctor_profiles_public FROM anon;
REVOKE ALL ON public.resident_profiles_public FROM anon;

-- ============================================
-- FIX: Add missing RLS policies for clinical_session_invitations
-- ============================================

-- Check if policy exists and add proper SELECT policy
DO $$
BEGIN
    -- Drop existing policies if they exist to recreate properly
    DROP POLICY IF EXISTS "Organizers and invited doctors can view invitations" ON public.clinical_session_invitations;
    DROP POLICY IF EXISTS "Doctors can view their invitations" ON public.clinical_session_invitations;
EXCEPTION WHEN undefined_object THEN
    -- Policy doesn't exist, continue
END $$;

-- Add SELECT policy for clinical_session_invitations
CREATE POLICY "Users can view their own invitations"
ON public.clinical_session_invitations
FOR SELECT
TO authenticated
USING (
    doctor_id = auth.uid() 
    OR EXISTS (
        SELECT 1 FROM public.clinical_sessions cs 
        WHERE cs.id = session_id AND cs.organizer_id = auth.uid()
    )
);

-- ============================================
-- FIX: Add missing RLS policies for email_history
-- ============================================

-- Drop existing policy to recreate comprehensive ones
DO $$
BEGIN
    DROP POLICY IF EXISTS "Doctors can view their own email history" ON public.email_history;
EXCEPTION WHEN undefined_object THEN
    -- Policy doesn't exist, continue
END $$;

-- Recreate comprehensive SELECT policy
CREATE POLICY "Doctors can view their own email history"
ON public.email_history
FOR SELECT
TO authenticated
USING (doctor_id = auth.uid());

-- Deny INSERT/UPDATE/DELETE from client (only edge functions should manage this)
CREATE POLICY "Only system can insert email history"
ON public.email_history
FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "Email history is immutable"
ON public.email_history
FOR UPDATE
TO authenticated
USING (false);

CREATE POLICY "Email history cannot be deleted by users"
ON public.email_history
FOR DELETE
TO authenticated
USING (false);