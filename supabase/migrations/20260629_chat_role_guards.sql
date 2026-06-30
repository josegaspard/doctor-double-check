-- Candados de chat a nivel BD (cliente 2026-06-29). Endurece la policy de
-- inserción de chat_sessions para que NO se puedan crear chats prohibidos
-- aunque alguien intente saltarse el front:
--   - paciente ↔ paciente  : BLOQUEADO (los pacientes no chatean entre sí)
--   - paciente ↔ residente  : BLOQUEADO
--   - residente → paciente  : BLOQUEADO
-- Permitido: doctor↔paciente, doctor↔residente, residente↔residente, residente↔doctor.
-- Usa has_role() (SECURITY DEFINER) para leer roles sin chocar con RLS de user_roles.

DROP POLICY IF EXISTS "Authenticated users can create sessions" ON public.chat_sessions;

CREATE POLICY "Authenticated users can create sessions"
ON public.chat_sessions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = participant1_id
  AND NOT (
    (
      public.has_role(participant1_id, 'patient'::app_role)
      AND (
        public.has_role(participant2_id, 'patient'::app_role)
        OR public.has_role(participant2_id, 'resident'::app_role)
      )
    )
    OR (
      public.has_role(participant1_id, 'resident'::app_role)
      AND public.has_role(participant2_id, 'patient'::app_role)
    )
  )
);
