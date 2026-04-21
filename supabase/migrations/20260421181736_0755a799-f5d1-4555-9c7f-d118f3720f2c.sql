-- 1. Add cofepris_permit column to doctor_profiles
ALTER TABLE public.doctor_profiles
  ADD COLUMN IF NOT EXISTS cofepris_permit text;

-- 2. Backfill TEST cedula + cofepris for all doctors (clearly fake test values)
UPDATE public.doctor_profiles
SET cedula_profesional = COALESCE(NULLIF(cedula_profesional, ''), 'CED-' || left(user_id::text, 8))
WHERE cedula_profesional IS NULL OR cedula_profesional = '';

UPDATE public.doctor_profiles
SET cofepris_permit = 'COF-' || left(user_id::text, 8)
WHERE cofepris_permit IS NULL OR cofepris_permit = '';

-- 3. Add habit amount columns to medical_history
ALTER TABLE public.medical_history
  ADD COLUMN IF NOT EXISTS habit_alcohol_amount text,
  ADD COLUMN IF NOT EXISTS habit_smoking_amount text,
  ADD COLUMN IF NOT EXISTS habit_vaping_amount text,
  ADD COLUMN IF NOT EXISTS habit_hookah_amount text,
  ADD COLUMN IF NOT EXISTS habit_drugs_amount text,
  ADD COLUMN IF NOT EXISTS habit_exercise_amount text;