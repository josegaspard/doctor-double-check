-- Add edit tracking and author info to medical_news
ALTER TABLE public.medical_news 
  ADD COLUMN IF NOT EXISTS last_edited_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_edited_by uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS author_bio text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS author_social jsonb DEFAULT '{}'::jsonb;

-- Add storage policy for news/ prefix uploads (any authenticated user can upload to news/ folder)
CREATE POLICY "Authenticated users can upload news images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'thumbnails' 
  AND (storage.foldername(name))[1] = 'news'
  AND auth.uid() IS NOT NULL
);

-- Allow update/delete of news images by authenticated users
CREATE POLICY "Authenticated users can update news images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'thumbnails' 
  AND (storage.foldername(name))[1] = 'news'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated users can delete news images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'thumbnails' 
  AND (storage.foldername(name))[1] = 'news'
  AND auth.uid() IS NOT NULL
);