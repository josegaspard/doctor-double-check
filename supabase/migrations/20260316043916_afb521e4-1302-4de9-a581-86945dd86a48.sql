
-- Allow anyone (including anonymous) to read active campaigns for ad delivery
-- This only exposes targeting metadata (target_roles, target_language), not billing data
CREATE POLICY "Public can read active campaigns for ad delivery"
ON public.ad_campaigns
FOR SELECT
TO public
USING (status = 'active');

-- Also ensure ad_placements and ad_creatives are readable by everyone for ad delivery
-- Check if policies exist first by using IF NOT EXISTS pattern via DO block
DO $$
BEGIN
  -- ad_placements: allow public read of active placements
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ad_placements' AND policyname = 'Public can read active placements'
  ) THEN
    EXECUTE 'CREATE POLICY "Public can read active placements" ON public.ad_placements FOR SELECT TO public USING (is_active = true)';
  END IF;

  -- ad_creatives: allow public read of active creatives
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ad_creatives' AND policyname = 'Public can read active creatives'
  ) THEN
    EXECUTE 'CREATE POLICY "Public can read active creatives" ON public.ad_creatives FOR SELECT TO public USING (is_active = true)';
  END IF;

  -- ad_config: allow public read
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ad_config' AND policyname = 'Public can read ad config'
  ) THEN
    EXECUTE 'CREATE POLICY "Public can read ad config" ON public.ad_config FOR SELECT TO public USING (true)';
  END IF;

  -- ad_events: allow public insert for tracking
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ad_events' AND policyname = 'Public can insert ad events'
  ) THEN
    EXECUTE 'CREATE POLICY "Public can insert ad events" ON public.ad_events FOR INSERT TO public WITH CHECK (true)';
  END IF;
END $$;
