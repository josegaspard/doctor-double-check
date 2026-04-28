-- Phase 2: Extended clinical history + child sub-profiles

-- 1. Add JSONB column for extended clinical data (chronic_other, surgeries_detail, complications, family_matrix, habits_detail)
ALTER TABLE public.patient_clinical_history
  ADD COLUMN IF NOT EXISTS extended_data jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.patient_clinical_history.extended_data IS
  'Extended clinical fields stored as flexible JSON: chronic_other (cual/diagnostico/tratamiento/fecha), surgeries (array of {description,date,complications}), complications (text), family_matrix ({disease: [relations]}), habits_detail ({alcoholism:{drink,frequency,amount}, smoking:{cigarette:{frequency,amount}, vape:{...}, hookah:{...}}, drugs:{frequency,amount}, physical_activity:{type,frequency}})';

-- 2. Create child_profiles table — sub-profiles linked to a parent patient, no own auth user
CREATE TABLE IF NOT EXISTS public.child_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  date_of_birth date NOT NULL,
  sex text,
  blood_type text,
  height_cm numeric,
  weight_kg numeric,
  allergies text,
  chronic_conditions text,
  current_medications text,
  vaccines jsonb NOT NULL DEFAULT '{}'::jsonb,
  extended_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  invited_at timestamptz,
  inherited_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_child_profiles_parent ON public.child_profiles(parent_id);

ALTER TABLE public.child_profiles ENABLE ROW LEVEL SECURITY;

-- Parent (the mother/father logged in) can fully manage their children's records
CREATE POLICY "Parents manage own children records select"
  ON public.child_profiles FOR SELECT
  USING (auth.uid() = parent_id);

CREATE POLICY "Parents manage own children records insert"
  ON public.child_profiles FOR INSERT
  WITH CHECK (auth.uid() = parent_id);

CREATE POLICY "Parents manage own children records update"
  ON public.child_profiles FOR UPDATE
  USING (auth.uid() = parent_id);

CREATE POLICY "Parents manage own children records delete"
  ON public.child_profiles FOR DELETE
  USING (auth.uid() = parent_id);

-- Doctors can read child records of patients who have an active consultation/chat with them
CREATE POLICY "Doctors read child records of active patients"
  ON public.child_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.consultations c
      WHERE c.patient_id = child_profiles.parent_id
        AND c.doctor_id = auth.uid()
        AND c.status IN ('active','completed')
    )
  );

-- Trigger to update updated_at
CREATE TRIGGER update_child_profiles_updated_at
  BEFORE UPDATE ON public.child_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();