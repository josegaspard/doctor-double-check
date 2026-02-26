
-- 1. Add badge_override to doctor_profiles for admin-managed badges
ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS badge_override text DEFAULT NULL;
-- Values: 'pro', 'new', or NULL (auto-calculated)

-- 2. Add commission rates per business type to payout_settings
ALTER TABLE public.payout_settings ADD COLUMN IF NOT EXISTS commission_consultation numeric DEFAULT NULL;
ALTER TABLE public.payout_settings ADD COLUMN IF NOT EXISTS commission_recording numeric DEFAULT NULL;
ALTER TABLE public.payout_settings ADD COLUMN IF NOT EXISTS commission_live numeric DEFAULT NULL;
ALTER TABLE public.payout_settings ADD COLUMN IF NOT EXISTS commission_chat numeric DEFAULT NULL;
ALTER TABLE public.payout_settings ADD COLUMN IF NOT EXISTS commission_content numeric DEFAULT NULL;

-- 3. Create expediente_otp table for medical record OTP access
CREATE TABLE IF NOT EXISTS public.expediente_otp (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id uuid NOT NULL,
  doctor_id uuid NOT NULL,
  otp_code text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.expediente_otp ENABLE ROW LEVEL SECURITY;

-- Patients can create and view their own OTPs
CREATE POLICY "Patients can create OTP" ON public.expediente_otp
  FOR INSERT WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Patients can view own OTP" ON public.expediente_otp
  FOR SELECT USING (auth.uid() = patient_id);

-- Doctors can verify OTP sent to them
CREATE POLICY "Doctors can view OTP for them" ON public.expediente_otp
  FOR SELECT USING (auth.uid() = doctor_id);

-- Doctors can mark OTP as used
CREATE POLICY "Doctors can update OTP" ON public.expediente_otp
  FOR UPDATE USING (auth.uid() = doctor_id);

-- Update the public view to include badge_override
DROP VIEW IF EXISTS public.doctor_profiles_public;
CREATE VIEW public.doctor_profiles_public AS
  SELECT 
    user_id, id, specialty, bio, rating, total_consultations,
    followers_count, consultation_fee, available_for_double_check,
    available_for_clinical_sessions, location, office_hours_start,
    office_hours_end, office_days, status, created_at, updated_at,
    badge_override
  FROM public.doctor_profiles
  WHERE status = 'approved';
