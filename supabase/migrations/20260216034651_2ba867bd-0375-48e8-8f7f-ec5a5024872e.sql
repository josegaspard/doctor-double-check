
-- Drop the overly permissive public SELECT policy on doctor-content bucket
DROP POLICY IF EXISTS "Public doctor content is accessible" ON storage.objects;

-- Doctors can view their own content files
CREATE POLICY "Doctors can view own content files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'doctor-content' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Authenticated users can view public content via signed URLs (app controls access)
CREATE POLICY "Authenticated users can view public doctor content"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'doctor-content'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM public.doctor_content dc
    WHERE dc.file_url LIKE '%' || storage.filename(name) || '%'
    AND dc.is_public = true
  )
);

-- Admins can view all doctor content
CREATE POLICY "Admins can view all doctor content"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'doctor-content' 
  AND public.has_role(auth.uid(), 'admin')
);
