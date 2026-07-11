-- FIX booking P0 (parte 2): el paciente no podía insertar la notificación de
-- "nueva solicitud de cita" para el doctor (RLS solo permitía notificar a uno mismo,
-- o al doctor notificar). El insert fallaba en silencio dentro del try/catch → el
-- doctor nunca recibía la campanita de la solicitud.
-- Policy acotada: un paciente puede crear una notificación 'system' para un usuario
-- SOLO si existe una cita entre ambos (él como paciente, el destinatario como doctor).
CREATE POLICY "Patients can notify doctor of their appointment"
  ON public.notifications
  FOR INSERT
  TO public
  WITH CHECK (
    type = 'system'::notification_type
    AND EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.doctor_id = notifications.user_id
        AND a.patient_id = auth.uid()
    )
  );
