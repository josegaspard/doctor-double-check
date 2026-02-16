-- Allow doctors to insert rating_request notifications for their patients
CREATE POLICY "Doctors can send rating notifications to patients"
ON public.notifications
FOR INSERT
WITH CHECK (
  type = 'rating_request'::notification_type
  AND EXISTS (
    SELECT 1 FROM public.chat_sessions cs
    WHERE (cs.participant1_id = auth.uid() OR cs.participant2_id = auth.uid())
      AND (cs.participant1_id = user_id OR cs.participant2_id = user_id)
      AND auth.uid() != user_id
  )
);