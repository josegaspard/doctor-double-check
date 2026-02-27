
-- 1. Add signature_url to doctor_profiles for prescription signatures
ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS signature_url text DEFAULT NULL;

-- 2. Add RLS policies for doctors with can_publish_news to manage medical_news
CREATE POLICY "Doctors with permission can insert news"
  ON public.medical_news FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM public.doctor_profiles
      WHERE user_id = auth.uid()
      AND can_publish_news = true
      AND status = 'approved'
    )
  );

CREATE POLICY "Doctors with permission can update own news"
  ON public.medical_news FOR UPDATE
  USING (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM public.doctor_profiles
      WHERE user_id = auth.uid()
      AND can_publish_news = true
      AND status = 'approved'
    )
  );

CREATE POLICY "Doctors with permission can delete own news"
  ON public.medical_news FOR DELETE
  USING (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM public.doctor_profiles
      WHERE user_id = auth.uid()
      AND can_publish_news = true
      AND status = 'approved'
    )
  );

CREATE POLICY "Doctors can view own news"
  ON public.medical_news FOR SELECT
  USING (auth.uid() = created_by);
