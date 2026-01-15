-- =====================================================
-- SECURITY FIXES MIGRATION
-- =====================================================

-- 1. Drop existing overly permissive policies on profiles
DROP POLICY IF EXISTS "Users can view own full profile" ON public.profiles;

-- 2. Create secure policies for profiles
-- Only users can see their own full profile (including email)
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

-- 3. Create a secure public view for profiles (without email)
CREATE OR REPLACE VIEW public.profiles_public AS
SELECT 
  id,
  name,
  avatar_url,
  is_identity_verified,
  created_at,
  updated_at
FROM public.profiles;

-- Grant access to the public view
GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- 4. Create secure public view for doctor_profiles (hiding sensitive credentials)
CREATE OR REPLACE VIEW public.doctor_profiles_public AS
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
  -- Excluded: license, cedula_profesional, numero_consejo
FROM public.doctor_profiles;

-- Grant access to the public view
GRANT SELECT ON public.doctor_profiles_public TO anon, authenticated;

-- 5. Create secure public view for resident_profiles (hiding sensitive credentials)
CREATE OR REPLACE VIEW public.resident_profiles_public AS
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
  -- Excluded: titulo_medicina, cedula_profesional
FROM public.resident_profiles;

-- Grant access to the public view
GRANT SELECT ON public.resident_profiles_public TO anon, authenticated;

-- 6. Update consultations INSERT policy to require approved doctor
DROP POLICY IF EXISTS "Doctors can create consultations" ON public.consultations;

CREATE POLICY "Approved doctors can create consultations" 
ON public.consultations 
FOR INSERT 
WITH CHECK (
  auth.uid() = doctor_id 
  AND is_approved_doctor(auth.uid())
);

-- 7. Update vault_access policies to validate doctor is approved
DROP POLICY IF EXISTS "Patients can manage vault access for own files" ON public.vault_access;

CREATE POLICY "Patients can grant access to approved doctors" 
ON public.vault_access 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM vault_files 
    WHERE vault_files.id = file_id 
    AND vault_files.patient_id = auth.uid()
  )
  AND is_approved_doctor(doctor_id)
);

CREATE POLICY "Patients can view vault access for own files" 
ON public.vault_access 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM vault_files 
    WHERE vault_files.id = file_id 
    AND vault_files.patient_id = auth.uid()
  )
);

CREATE POLICY "Patients can revoke vault access for own files" 
ON public.vault_access 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM vault_files 
    WHERE vault_files.id = file_id 
    AND vault_files.patient_id = auth.uid()
  )
);

-- 8. Update clinical_session_invitations to require approved doctor
DROP POLICY IF EXISTS "Organizers can create invitations" ON public.clinical_session_invitations;

CREATE POLICY "Organizers can invite approved doctors" 
ON public.clinical_session_invitations 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM clinical_sessions
    WHERE clinical_sessions.id = session_id 
    AND clinical_sessions.organizer_id = auth.uid()
  )
  AND is_approved_doctor(doctor_id)
);

-- 9. Update subscriptions INSERT to validate creator exists
DROP POLICY IF EXISTS "Users can create subscriptions" ON public.subscriptions;

CREATE POLICY "Users can subscribe to valid creators" 
ON public.subscriptions 
FOR INSERT 
WITH CHECK (
  auth.uid() = subscriber_id 
  AND (is_approved_doctor(creator_id) OR is_approved_resident(creator_id))
);

-- 10. Fix chat_messages INSERT policy to be more strict
DROP POLICY IF EXISTS "Participants can send messages" ON public.chat_messages;

CREATE POLICY "Session participants can send messages" 
ON public.chat_messages 
FOR INSERT 
WITH CHECK (
  auth.uid() = sender_id 
  AND EXISTS (
    SELECT 1 FROM chat_sessions
    WHERE chat_sessions.id = session_id 
    AND chat_sessions.status = 'active'
    AND (chat_sessions.participant1_id = auth.uid() OR chat_sessions.participant2_id = auth.uid())
  )
);