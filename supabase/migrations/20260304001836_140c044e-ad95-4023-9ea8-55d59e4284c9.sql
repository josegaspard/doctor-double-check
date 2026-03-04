
-- Phase 2: live_consultation_requests table
CREATE TABLE public.live_consultation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_id UUID NOT NULL REFERENCES public.lives(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL,
  doctor_id UUID NOT NULL,
  message TEXT NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'wallet',
  amount NUMERIC NOT NULL DEFAULT 0,
  chat_session_id UUID REFERENCES public.chat_sessions(id),
  consultation_id UUID REFERENCES public.consultations(id),
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.live_consultation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can insert own requests"
  ON public.live_consultation_requests
  FOR INSERT TO authenticated
  WITH CHECK (patient_id = auth.uid());

CREATE POLICY "Patients can view own requests"
  ON public.live_consultation_requests
  FOR SELECT TO authenticated
  USING (patient_id = auth.uid());

CREATE POLICY "Doctors can view their requests"
  ON public.live_consultation_requests
  FOR SELECT TO authenticated
  USING (doctor_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.live_consultation_requests;

-- Phase 4: Add interaction limit columns to lives table
ALTER TABLE public.lives 
  ADD COLUMN IF NOT EXISTS chat_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS max_questions INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_paid_chats INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS questions_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_chats_count INTEGER NOT NULL DEFAULT 0;
