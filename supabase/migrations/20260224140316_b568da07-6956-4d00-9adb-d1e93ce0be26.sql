CREATE POLICY "Doctors can send video call notifications to consultation patients"
  ON public.notifications
  FOR INSERT
  WITH CHECK (
    type = 'video_call'::notification_type
    AND EXISTS (
      SELECT 1 FROM consultations c
      WHERE c.doctor_id = auth.uid()
        AND c.patient_id = notifications.user_id
        AND c.status = 'active'
    )
  );