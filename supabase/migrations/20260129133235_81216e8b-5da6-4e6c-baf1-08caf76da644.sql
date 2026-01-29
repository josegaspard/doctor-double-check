-- Fix storage policies for documents bucket (chat file uploads)
-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can upload chat documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view chat documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own chat documents" ON storage.objects;

-- Create policy for uploading chat documents
CREATE POLICY "Users can upload chat documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' 
  AND auth.uid() IS NOT NULL
);

-- Create policy for viewing chat documents (participants only)
CREATE POLICY "Users can view chat documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents'
  AND auth.uid() IS NOT NULL
);

-- Create policy for deleting own documents
CREATE POLICY "Users can delete own chat documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

-- Add priority_score column to chat_sessions for Premium prioritization
ALTER TABLE public.chat_sessions 
ADD COLUMN IF NOT EXISTS priority_score INTEGER DEFAULT 0;

-- Create function to update priority score based on subscription tier
CREATE OR REPLACE FUNCTION public.get_subscription_priority(p_subscriber_id uuid, p_creator_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN EXISTS (
      SELECT 1 FROM subscriptions 
      WHERE subscriber_id = p_subscriber_id 
        AND creator_id = p_creator_id 
        AND is_active = true 
        AND tier = 'premium'
    ) THEN 100
    WHEN EXISTS (
      SELECT 1 FROM subscriptions 
      WHERE subscriber_id = p_subscriber_id 
        AND creator_id = p_creator_id 
        AND is_active = true 
        AND tier = 'basic'
    ) THEN 50
    ELSE 0
  END;
$$;