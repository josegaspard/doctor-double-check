CREATE POLICY "Patients can delete own prescriptions"
ON public.prescriptions FOR DELETE
USING (auth.uid() = patient_id);