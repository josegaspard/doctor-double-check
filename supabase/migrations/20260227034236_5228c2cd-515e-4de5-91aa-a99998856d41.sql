
-- Fix #2: Allow doctors to insert OTPs (currently only patients can)
DROP POLICY IF EXISTS "Patients can create OTP" ON public.expediente_otp;
CREATE POLICY "Authenticated users can create OTP"
  ON public.expediente_otp FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = doctor_id OR auth.uid() = patient_id
  );

-- Fix #4: Allow patients to read doctor signature_url via security definer function
CREATE OR REPLACE FUNCTION public.get_doctor_signature(p_doctor_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT signature_url
  FROM public.doctor_profiles
  WHERE user_id = p_doctor_user_id
  LIMIT 1;
$$;

-- Fix #5: Add content_id column to purchases for doctor_content purchases
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS content_id uuid REFERENCES public.doctor_content(id);

-- Allow purchases lookup by content_id
CREATE INDEX IF NOT EXISTS idx_purchases_content_id ON public.purchases(content_id) WHERE content_id IS NOT NULL;
