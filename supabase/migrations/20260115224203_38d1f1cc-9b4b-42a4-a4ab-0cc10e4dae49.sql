-- Create a private bucket for identity verification documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('identity-documents', 'identity-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for identity-documents bucket
CREATE POLICY "Users can upload their own identity documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'identity-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own identity documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'identity-documents' 
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin')
  )
);

CREATE POLICY "Users can delete their own identity documents"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'identity-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow admins to view all identity verifications
CREATE POLICY "Admins can view all identity verifications"
ON public.identity_verifications
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Allow users to create their own verification requests
CREATE POLICY "Users can create verification requests"
ON public.identity_verifications
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own pending verifications
CREATE POLICY "Users can update own pending verifications"
ON public.identity_verifications
FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending');