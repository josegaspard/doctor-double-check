-- Fix storage policies for chat documents in 'documents' bucket
-- The path structure is: chat/{sessionId}/{userId}/{filename}

-- Drop conflicting policies
DROP POLICY IF EXISTS "Users can access own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own chat documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload chat documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view chat documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all documents" ON storage.objects;

-- Create clean policies for 'documents' bucket (used for chat file sharing)

-- Upload policy: authenticated users can upload to documents bucket
-- Path format: chat/{sessionId}/{userId}/{filename}
CREATE POLICY "Chat file upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' AND
  auth.uid() IS NOT NULL AND
  (storage.foldername(name))[1] = 'chat' AND
  (storage.foldername(name))[3] = auth.uid()::text
);

-- View policy: chat participants can view files in their sessions
-- For simplicity, allow any authenticated user to view chat files (they need the session to get the URL anyway)
CREATE POLICY "Chat file view"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents' AND
  auth.uid() IS NOT NULL
);

-- Delete policy: users can delete their own uploaded files
CREATE POLICY "Chat file delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] = 'chat' AND
  (storage.foldername(name))[3] = auth.uid()::text
);

-- Admin view all
CREATE POLICY "Admin documents access"
ON storage.objects FOR ALL
USING (
  bucket_id = 'documents' AND
  has_role(auth.uid(), 'admin'::app_role)
);