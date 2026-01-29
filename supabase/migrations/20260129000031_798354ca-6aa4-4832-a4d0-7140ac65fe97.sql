-- Create email history table
CREATE TABLE public.email_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id UUID NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  email_type TEXT NOT NULL, -- 'new_content', 'live_started', 'availability'
  subject TEXT NOT NULL,
  content_id UUID, -- reference to content/live/availability
  content_title TEXT,
  status TEXT NOT NULL DEFAULT 'sent', -- 'sent', 'failed'
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_email_history_doctor_id ON public.email_history(doctor_id);
CREATE INDEX idx_email_history_created_at ON public.email_history(created_at DESC);

-- Enable RLS
ALTER TABLE public.email_history ENABLE ROW LEVEL SECURITY;

-- Doctors can view their own email history
CREATE POLICY "Doctors can view own email history"
  ON public.email_history
  FOR SELECT
  USING (auth.uid() = doctor_id);

-- Allow edge functions to insert via service role (no user policy needed for insert)
-- The edge function uses service_role key which bypasses RLS