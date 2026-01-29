-- FIX 1: Crear funciones SECURITY DEFINER para romper recursión clinical_sessions ↔ clinical_session_invitations

-- Función para verificar si un usuario es participante de una sesión clínica
CREATE OR REPLACE FUNCTION public.user_is_clinical_session_participant(p_session_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM clinical_session_invitations csi
    WHERE csi.session_id = p_session_id
      AND csi.doctor_id = p_user_id
  )
$$;

-- Función para verificar si un usuario es organizador de la sesión de una invitación
CREATE OR REPLACE FUNCTION public.user_is_invitation_organizer(p_invitation_session_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM clinical_sessions cs
    WHERE cs.id = p_invitation_session_id
      AND cs.organizer_id = p_user_id
  )
$$;

-- Reemplazar política de clinical_sessions (rompe la recursión)
DROP POLICY IF EXISTS "Doctors can view clinical sessions" ON clinical_sessions;
CREATE POLICY "Doctors can view clinical sessions" ON clinical_sessions
  FOR SELECT USING (
    auth.uid() = organizer_id 
    OR public.user_is_clinical_session_participant(id, auth.uid())
  );

-- Reemplazar políticas de clinical_session_invitations (rompe la recursión)
DROP POLICY IF EXISTS "Invited doctors can view invitations" ON clinical_session_invitations;
DROP POLICY IF EXISTS "Users can view their own invitations" ON clinical_session_invitations;

CREATE POLICY "Doctors can view relevant invitations" ON clinical_session_invitations
  FOR SELECT USING (
    auth.uid() = doctor_id 
    OR public.user_is_invitation_organizer(session_id, auth.uid())
  );

DROP POLICY IF EXISTS "Organizers can invite approved doctors" ON clinical_session_invitations;
CREATE POLICY "Organizers can invite approved doctors" ON clinical_session_invitations
  FOR INSERT WITH CHECK (
    public.user_is_invitation_organizer(session_id, auth.uid()) 
    AND is_approved_doctor(doctor_id)
  );