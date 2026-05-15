-- Permite a doctores APROBADOS enviar notificaciones tipo 'system' a cualquier
-- usuario (para flows como "invitar paciente a dar acceso al expediente").
--
-- Sin esto, AddPatientModal falla con:
--   "new row violates row-level security policy for table 'notifications'"
-- porque la policy base "Users can create own notifications" exige
-- auth.uid() = user_id, lo cual es falso al notificar a otra persona.

DROP POLICY IF EXISTS "Doctors can send invite notifications" ON public.notifications;
CREATE POLICY "Doctors can send invite notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (
  type = 'system'::public.notification_type
  AND EXISTS (
    SELECT 1 FROM public.doctor_profiles dp
    WHERE dp.user_id = auth.uid()
      AND dp.status = 'approved'
  )
);
