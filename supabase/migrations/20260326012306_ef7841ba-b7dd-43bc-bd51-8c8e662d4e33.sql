
-- Phase 6A: Add post-consultation summary columns to consultations
ALTER TABLE public.consultations 
  ADD COLUMN IF NOT EXISTS doctor_summary TEXT,
  ADD COLUMN IF NOT EXISTS doctor_recommendations TEXT,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Phase 6B: Create doctor_resident_connections table
CREATE TABLE public.doctor_resident_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL,
  resident_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  UNIQUE(doctor_id, resident_id)
);

ALTER TABLE public.doctor_resident_connections ENABLE ROW LEVEL SECURITY;

-- RLS: Residents can request connections (insert)
CREATE POLICY "Residents can request connections"
  ON public.doctor_resident_connections
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = resident_id);

-- RLS: Both parties can view their connections
CREATE POLICY "Users can view own connections"
  ON public.doctor_resident_connections
  FOR SELECT
  TO authenticated
  USING (auth.uid() = doctor_id OR auth.uid() = resident_id);

-- RLS: Doctors can update status of their connections
CREATE POLICY "Doctors can respond to connections"
  ON public.doctor_resident_connections
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = doctor_id);

-- RLS: Residents can delete pending connections
CREATE POLICY "Residents can cancel pending connections"
  ON public.doctor_resident_connections
  FOR DELETE
  TO authenticated
  USING (auth.uid() = resident_id AND status = 'pending');
