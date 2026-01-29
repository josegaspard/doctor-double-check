-- Rename confusing policy names to clarify they are NOT public access
DROP POLICY IF EXISTS "Doctor profiles public info viewable by everyone" ON public.doctor_profiles;
CREATE POLICY "Doctor profiles viewable by owner or admin only"
ON public.doctor_profiles FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Resident profiles public info viewable by everyone" ON public.resident_profiles;
CREATE POLICY "Resident profiles viewable by owner or admin only"
ON public.resident_profiles FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));