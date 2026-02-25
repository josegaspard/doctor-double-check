-- Allow doctors to see purchases made on their recordings
CREATE POLICY "Doctors can view purchases on their recordings"
ON public.purchases
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.recordings r
    WHERE r.id = purchases.recording_id
    AND r.doctor_id = auth.uid()
  )
);

-- Allow admins to view all purchases
CREATE POLICY "Admins can view all purchases"
ON public.purchases
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
);