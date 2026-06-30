-- Residentes pueden subir contenido / casos clínicos en MM Education (cliente 2026-06-29).
-- Antes solo doctores aprobados o admin podían crear en clinical_cases.
DROP POLICY IF EXISTS "Approved doctors or admins can create cases" ON public.clinical_cases;

CREATE POLICY "Doctors, residents or admins can create cases"
ON public.clinical_cases
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = author_id
  AND (
    public.is_approved_doctor(auth.uid())
    OR public.has_role(auth.uid(), 'resident'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);
