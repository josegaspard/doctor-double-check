-- Phase 3: Vaccination tracking

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vaccine_reminders_enabled boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.patient_vaccinations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  child_id uuid REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  vaccine_key text NOT NULL,
  dose_number integer NOT NULL DEFAULT 1,
  applied boolean NOT NULL DEFAULT true,
  application_date date,
  lot text,
  notes text,
  last_reminded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patient_id, child_id, vaccine_key, dose_number)
);

CREATE INDEX IF NOT EXISTS idx_patient_vaccinations_patient ON public.patient_vaccinations(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_vaccinations_child ON public.patient_vaccinations(child_id);
CREATE INDEX IF NOT EXISTS idx_patient_vaccinations_vaccine ON public.patient_vaccinations(vaccine_key);

ALTER TABLE public.patient_vaccinations ENABLE ROW LEVEL SECURITY;

-- Patient owns their vaccination rows (their own and their children's)
CREATE POLICY "Patients select own vaccinations"
  ON public.patient_vaccinations FOR SELECT
  USING (auth.uid() = patient_id);

CREATE POLICY "Patients insert own vaccinations"
  ON public.patient_vaccinations FOR INSERT
  WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Patients update own vaccinations"
  ON public.patient_vaccinations FOR UPDATE
  USING (auth.uid() = patient_id);

CREATE POLICY "Patients delete own vaccinations"
  ON public.patient_vaccinations FOR DELETE
  USING (auth.uid() = patient_id);

-- Doctors can read vaccinations of patients with active or completed consultations
CREATE POLICY "Doctors read vaccinations of consulted patients"
  ON public.patient_vaccinations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.consultations c
      WHERE c.patient_id = patient_vaccinations.patient_id
        AND c.doctor_id = auth.uid()
        AND c.status IN ('active','completed')
    )
  );

CREATE TRIGGER update_patient_vaccinations_updated_at
  BEFORE UPDATE ON public.patient_vaccinations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();