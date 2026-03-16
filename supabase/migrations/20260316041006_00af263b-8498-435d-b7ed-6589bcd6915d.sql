
-- Allow doctors with vault access to view patient clinical history
CREATE POLICY "Doctors with vault access can view clinical history"
ON public.patient_clinical_history FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.vault_files vf
    INNER JOIN public.vault_access va ON va.file_id = vf.id
    WHERE vf.patient_id = patient_clinical_history.patient_id
    AND va.doctor_id = auth.uid()
    AND (va.expires_at IS NULL OR va.expires_at > now())
  )
);
