-- Fix clinical sessions policy with correct column references
DROP POLICY IF EXISTS "Doctors can view clinical sessions" ON public.clinical_sessions;

CREATE POLICY "Doctors can view clinical sessions" 
ON public.clinical_sessions FOR SELECT USING (
    auth.uid() = organizer_id OR 
    EXISTS (
        SELECT 1 FROM public.clinical_session_invitations 
        WHERE clinical_session_invitations.session_id = clinical_sessions.id 
        AND clinical_session_invitations.doctor_id = auth.uid()
    )
);

-- Fix recording access to enforce purchase validation
DROP POLICY IF EXISTS "Recordings are viewable by everyone" ON public.recordings;

CREATE POLICY "Users can view accessible recordings" 
ON public.recordings FOR SELECT
USING (
  price = 0 OR
  auth.uid() = doctor_id OR
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'doctor') OR
  EXISTS (
    SELECT 1 FROM public.purchases 
    WHERE purchases.recording_id = recordings.id 
    AND purchases.user_id = auth.uid()
  )
);