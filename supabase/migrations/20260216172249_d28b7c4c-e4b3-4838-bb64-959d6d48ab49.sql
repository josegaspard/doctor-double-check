
-- SECURITY/FUNCTIONAL FIXES FOR REFERRALS & PRESCRIPTIONS

-- 1) Referral codes should NOT be publicly readable (prevents harvesting active codes)
DROP POLICY IF EXISTS "Anyone can view active codes for validation" ON public.referral_codes;

-- 2) Prescriptions: ensure doctors can INSERT their own prescriptions (WITH CHECK required)
DROP POLICY IF EXISTS "Doctors can manage own prescriptions" ON public.prescriptions;

CREATE POLICY "Doctors can view own prescriptions"
  ON public.prescriptions
  FOR SELECT
  USING (auth.uid() = doctor_id);

CREATE POLICY "Doctors can create own prescriptions"
  ON public.prescriptions
  FOR INSERT
  WITH CHECK (auth.uid() = doctor_id);

CREATE POLICY "Doctors can update own prescriptions"
  ON public.prescriptions
  FOR UPDATE
  USING (auth.uid() = doctor_id)
  WITH CHECK (auth.uid() = doctor_id);

CREATE POLICY "Doctors can delete own prescriptions"
  ON public.prescriptions
  FOR DELETE
  USING (auth.uid() = doctor_id);

-- Patients can still view their own prescriptions (keep existing policy if present)
-- (No change needed if it already exists)
