-- Fix RLS policy: Allow all authenticated users to view recording metadata
-- (they can see the listing, but video playback is still protected by purchase verification)

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can view accessible recordings" ON public.recordings;

-- Create new policy that allows all authenticated users to see recording listings
CREATE POLICY "Authenticated users can view recordings metadata"
ON public.recordings
FOR SELECT
TO authenticated
USING (true);

-- Note: Access to actual video content is controlled in the RecordingPlayer component
-- which verifies ownership before showing the video URL