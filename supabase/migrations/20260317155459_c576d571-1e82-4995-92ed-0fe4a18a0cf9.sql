
-- Add phone column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;

-- Create phone_verifications table
CREATE TABLE public.phone_verifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  phone text NOT NULL,
  otp_code text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  verified_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own verifications
CREATE POLICY "Users can view own phone verifications"
ON public.phone_verifications
FOR SELECT
USING (auth.uid() = user_id);

-- Only system (service role) inserts - edge function uses service role
CREATE POLICY "Service role can manage phone verifications"
ON public.phone_verifications
FOR ALL
USING (auth.uid() = user_id);

-- Index for lookup
CREATE INDEX idx_phone_verifications_user_phone ON public.phone_verifications (user_id, phone, otp_code);
