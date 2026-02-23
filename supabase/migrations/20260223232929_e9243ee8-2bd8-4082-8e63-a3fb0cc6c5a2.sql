-- Fix: Allow ALL users (including anonymous) to browse recording catalog
DROP POLICY IF EXISTS "Authenticated users can view recordings metadata" ON public.recordings;

CREATE POLICY "Anyone can browse recordings catalog"
ON public.recordings
FOR SELECT
USING (true);