
-- ITEM 2
DROP POLICY IF EXISTS "Authenticated users can view ratings" ON public.consultation_ratings;
CREATE POLICY "Participants and admins view ratings"
ON public.consultation_ratings FOR SELECT
TO authenticated
USING (
  auth.uid() = patient_id
  OR auth.uid() = doctor_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- ITEM 3
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='push_subscriptions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.push_subscriptions';
  END IF;
END $$;

-- ITEM 4a recordings
DROP POLICY IF EXISTS "Purchasers can view recording files" ON storage.objects;
CREATE POLICY "Purchasers can view recording files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'recordings'
  AND EXISTS (
    SELECT 1
    FROM public.purchases p
    JOIN public.recordings r ON r.id = p.recording_id
    WHERE p.user_id = auth.uid()
      AND (
        r.video_url = storage.objects.name
        OR storage.filename(r.video_url) = storage.filename(storage.objects.name)
      )
  )
);

-- ITEM 4b doctor-content
DROP POLICY IF EXISTS "doctor-content restricted read" ON storage.objects;
CREATE POLICY "doctor-content restricted read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'doctor-content'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.doctor_content dc
      WHERE storage.filename(dc.file_url) = storage.filename(storage.objects.name)
        AND (
          (dc.is_public = true AND (dc.price IS NULL OR dc.price = 0))
          OR dc.creator_id = auth.uid()
          OR (dc.is_public = true AND (public.has_role(auth.uid(), 'doctor'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role)))
        )
    )
  )
);

-- ITEM 4c prescriptions
DROP POLICY IF EXISTS "Users can view prescription files" ON storage.objects;
CREATE POLICY "Users can view prescription files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'prescriptions'
  AND auth.uid() IS NOT NULL
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.prescriptions p
      WHERE p.patient_id = auth.uid()
        AND storage.filename(p.file_url) = storage.filename(storage.objects.name)
    )
  )
);

-- ITEM 5
CREATE OR REPLACE VIEW public.ad_campaigns_public
WITH (security_invoker = true)
AS
SELECT id, name, status, start_date, end_date, target_roles, target_language, placement_ids, created_at
FROM public.ad_campaigns
WHERE status = 'active';
GRANT SELECT ON public.ad_campaigns_public TO anon, authenticated;

-- ITEM 6
DROP POLICY IF EXISTS "Authenticated users can view followers" ON public.followers;
CREATE POLICY "Users see only their follow edges"
ON public.followers FOR SELECT
TO authenticated
USING (
  auth.uid() = follower_id
  OR auth.uid() = followed_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- ITEM 8 limpieza duplicados
DROP POLICY IF EXISTS "Authenticated users can view reviews" ON public.hospital_reviews;
DROP POLICY IF EXISTS "Anyone can read likes" ON public.news_comment_likes;
