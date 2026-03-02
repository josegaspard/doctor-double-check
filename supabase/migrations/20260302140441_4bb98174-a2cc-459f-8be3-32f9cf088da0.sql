
CREATE POLICY "Doctors can upload signatures"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = 'signatures'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND public.is_approved_doctor(auth.uid())
);

CREATE POLICY "Doctors can view own signatures"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = 'signatures'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "Doctors can update own signatures"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = 'signatures'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND public.is_approved_doctor(auth.uid())
);

CREATE POLICY "Doctors can delete own signatures"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = 'signatures'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND public.is_approved_doctor(auth.uid())
);
