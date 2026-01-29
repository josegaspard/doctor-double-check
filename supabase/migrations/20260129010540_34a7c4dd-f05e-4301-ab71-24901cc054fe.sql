-- ==========================================
-- SECURITY FIX 1: doctor-content bucket RLS
-- ==========================================

-- Drop existing permissive policies on storage.objects for doctor-content
DROP POLICY IF EXISTS "Doctor content is viewable by authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "doctor-content public read" ON storage.objects;
DROP POLICY IF EXISTS "doctor-content authenticated read" ON storage.objects;

-- Create restricted policy for doctor-content bucket
-- Only allow access if:
-- 1. User is the creator
-- 2. User is admin
-- 3. Content is public AND free (price = 0)
-- 4. User has purchased the content
CREATE POLICY "doctor-content restricted read" ON storage.objects
FOR SELECT USING (
  bucket_id = 'doctor-content' AND (
    -- Owner can always access
    auth.uid()::text = (storage.foldername(name))[1]
    -- Admin can always access
    OR public.has_role(auth.uid(), 'admin')
    -- Check if content is public and free, or user has purchased
    OR EXISTS (
      SELECT 1 FROM public.doctor_content dc
      WHERE dc.file_url LIKE '%' || name
      AND (
        -- Public and free content
        (dc.is_public = true AND (dc.price IS NULL OR dc.price = 0))
        -- Or creator
        OR dc.creator_id = auth.uid()
        -- Doctors and admins can view public content
        OR (dc.is_public = true AND (public.has_role(auth.uid(), 'doctor') OR public.has_role(auth.uid(), 'admin')))
      )
    )
  )
);

-- ==========================================
-- SECURITY FIX 2: vault_access expiration
-- ==========================================

-- Drop the existing policy for doctors viewing vault files
DROP POLICY IF EXISTS "Doctors can view files with access" ON public.vault_files;

-- Create new policy that validates expiration
CREATE POLICY "Doctors can view files with active access" ON public.vault_files
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.vault_access va
    WHERE va.file_id = vault_files.id 
    AND va.doctor_id = auth.uid()
    AND (va.expires_at IS NULL OR va.expires_at > now())
  )
);