
-- Add file_url column to prescriptions for attached files (images/PDFs)
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS file_url text;

-- Create prescriptions storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('prescriptions', 'prescriptions', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: Doctors can upload prescription files
CREATE POLICY "Doctors can upload prescription files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'prescriptions'
  AND auth.uid() IS NOT NULL
  AND public.has_role(auth.uid(), 'doctor')
);

-- RLS: Doctors and patients can view prescription files
CREATE POLICY "Users can view prescription files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'prescriptions'
  AND auth.uid() IS NOT NULL
  AND (
    -- Doctor who uploaded
    (storage.foldername(name))[1] = auth.uid()::text
    -- Patient who is the recipient (checked via prescriptions table)
    OR EXISTS (
      SELECT 1 FROM public.prescriptions p
      WHERE p.file_url LIKE '%' || name
      AND p.patient_id = auth.uid()
    )
    -- Or admin
    OR public.has_role(auth.uid(), 'admin')
  )
);

-- RLS: Doctors can delete own prescription files
CREATE POLICY "Doctors can delete own prescription files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'prescriptions'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
