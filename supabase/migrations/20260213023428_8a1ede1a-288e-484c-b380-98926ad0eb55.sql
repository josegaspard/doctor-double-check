
-- Fix: Replace overly permissive documents bucket SELECT policy with proper access control

-- Drop the permissive policy that allows any authenticated user to view all documents
DROP POLICY IF EXISTS "Users can view chat documents" ON storage.objects;

-- Policy 1: Users can access their own documents (folder structure: chat/{sessionId}/{userId}/...)
CREATE POLICY "Users can access own documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

-- Policy 2: Chat participants can view session documents
-- File path structure: chat/{sessionId}/{uploaderId}/{file}
CREATE POLICY "Chat participants can view session documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = 'chat'
  AND EXISTS (
    SELECT 1 FROM public.chat_sessions cs
    WHERE cs.id::text = (storage.foldername(name))[2]
    AND (cs.participant1_id = auth.uid() OR cs.participant2_id = auth.uid())
  )
);
