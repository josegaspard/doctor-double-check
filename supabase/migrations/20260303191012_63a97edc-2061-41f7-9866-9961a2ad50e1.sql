
-- Add INSERT RLS policies for onboarding
CREATE POLICY "Users can insert own doctor profile"
ON public.doctor_profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own resident profile"
ON public.resident_profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own wallet"
ON public.wallets FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
