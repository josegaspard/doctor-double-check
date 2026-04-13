-- 1. Remove overly permissive INSERT policy on wallet_transactions
DROP POLICY IF EXISTS "Users can create own transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.wallet_transactions;

-- 2. Fix user_roles: restrict SELECT to own role only
DROP POLICY IF EXISTS "Authenticated users can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;

CREATE POLICY "Users can view own role"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. Fix featured_events: restrict INSERT to authenticated users with matching user_id
DROP POLICY IF EXISTS "Anyone can insert featured events" ON public.featured_events;

CREATE POLICY "Authenticated users can insert own featured events"
  ON public.featured_events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 4. Make recordings storage bucket private
UPDATE storage.buckets
SET public = false
WHERE id = 'recordings';

-- 5. Replace public recordings SELECT policy with proper access control
DROP POLICY IF EXISTS "Recordings are publicly accessible" ON storage.objects;

CREATE POLICY "Doctors can view own recording files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'recordings'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Purchasers can view recording files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'recordings'
    AND EXISTS (
      SELECT 1 FROM public.purchases p
      JOIN public.recordings r ON r.id = p.recording_id
      WHERE p.user_id = auth.uid()
        AND r.video_url LIKE '%' || storage.filename(objects.name)
    )
  );

CREATE POLICY "Admins can view all recording files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'recordings'
    AND public.has_role(auth.uid(), 'admin')
  );