-- Fix: admins are allowed to publish clinical cases in /education.
-- Previously the RLS only checked is_approved_doctor(auth.uid()), so the
-- super-admin role could see the form but the INSERT failed silently with
-- "No se pudo publicar el caso" toast.
DROP POLICY IF EXISTS "Approved doctors can create cases" ON public.clinical_cases;
CREATE POLICY "Approved doctors or admins can create cases"
ON public.clinical_cases FOR INSERT
WITH CHECK (
  auth.uid() = author_id
  AND (
    public.is_approved_doctor(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Fix: MedicalRecord save was throwing "Error al guardar el expediente"
-- because the page sends habit_*_amount columns that did not exist on
-- patient_clinical_history. Add them (idempotent).
ALTER TABLE public.patient_clinical_history
  ADD COLUMN IF NOT EXISTS habit_alcohol_amount text,
  ADD COLUMN IF NOT EXISTS habit_smoking_amount text,
  ADD COLUMN IF NOT EXISTS habit_vaping_amount text,
  ADD COLUMN IF NOT EXISTS habit_hookah_amount text,
  ADD COLUMN IF NOT EXISTS habit_drugs_amount text,
  ADD COLUMN IF NOT EXISTS habit_exercise_amount text;
