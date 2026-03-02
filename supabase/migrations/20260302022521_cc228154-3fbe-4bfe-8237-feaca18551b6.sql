
-- 1. Drop the existing CHECK constraint on content_type and add platform_report
DO $$
BEGIN
  -- Find and drop the check constraint on content_type
  EXECUTE (
    SELECT 'ALTER TABLE public.reports DROP CONSTRAINT ' || conname
    FROM pg_constraint
    WHERE conrelid = 'public.reports'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%content_type%'
    LIMIT 1
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'No check constraint found on content_type, skipping drop';
END $$;

-- Add new check constraint with platform_report included
ALTER TABLE public.reports ADD CONSTRAINT reports_content_type_check
  CHECK (content_type IN ('live', 'recording', 'doctor', 'chat_message', 'platform_report'));

-- 2. Add new columns for enhanced reporting
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS attachment_urls text[];

-- 3. Make content_id nullable for platform reports (no specific content)
ALTER TABLE public.reports ALTER COLUMN content_id DROP NOT NULL;

-- 4. Create report-attachments storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('report-attachments', 'report-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- 5. RLS policies for report-attachments bucket
CREATE POLICY "Authenticated users can upload report attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'report-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own report attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'report-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Admins can view all report attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'report-attachments' AND has_role(auth.uid(), 'admin'::app_role));
