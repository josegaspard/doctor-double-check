
-- 1. Extend doctor_profiles
ALTER TABLE public.doctor_profiles
  ADD COLUMN IF NOT EXISTS university text,
  ADD COLUMN IF NOT EXISTS secondary_specialties text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS workplaces jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cedula_especialidad text,
  ADD COLUMN IF NOT EXISTS cedula_especialidad_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS cedula_especialidad_rejection_reason text;

-- 2. external_patients
CREATE TABLE IF NOT EXISTS public.external_patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.external_patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctor manages own external patients"
ON public.external_patients FOR ALL
USING (doctor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (doctor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_external_patients_doctor ON public.external_patients(doctor_id);

CREATE TRIGGER trg_external_patients_updated_at
BEFORE UPDATE ON public.external_patients
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. doctor_notes
CREATE TABLE IF NOT EXISTS public.doctor_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  external_patient_id uuid REFERENCES public.external_patients(id) ON DELETE SET NULL,
  title text,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.doctor_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctor manages own notes"
ON public.doctor_notes FOR ALL
USING (doctor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (doctor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_doctor_notes_doctor ON public.doctor_notes(doctor_id, created_at DESC);

CREATE TRIGGER trg_doctor_notes_updated_at
BEFORE UPDATE ON public.doctor_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
