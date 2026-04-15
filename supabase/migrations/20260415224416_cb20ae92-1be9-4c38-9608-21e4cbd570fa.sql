-- Atomic increment for paid_chats_count (P1-4)
CREATE OR REPLACE FUNCTION public.increment_paid_chats_count(p_live_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.lives
  SET paid_chats_count = paid_chats_count + 1
  WHERE id = p_live_id;
END;
$$;

-- Remove duplicate SELECT policy on ad_config (P2-10)
DROP POLICY IF EXISTS "Public can read" ON public.ad_config;

-- Remove duplicate/overlapping SELECT policies on ad_creatives (P2-11)
DROP POLICY IF EXISTS "Anyone can view active creatives" ON public.ad_creatives;

-- Restrict followers to authenticated users only (P2-4)
DROP POLICY IF EXISTS "Anyone can view followers" ON public.followers;
CREATE POLICY "Authenticated users can view followers"
ON public.followers FOR SELECT TO authenticated USING (true);

-- Restrict hospital_reviews to authenticated (P2-5)
DROP POLICY IF EXISTS "Anyone can view reviews" ON public.hospital_reviews;
CREATE POLICY "Authenticated users can view reviews"
ON public.hospital_reviews FOR SELECT TO authenticated USING (true);

-- Restrict news_comment_likes to authenticated (P2-5)
DROP POLICY IF EXISTS "Anyone can view likes" ON public.news_comment_likes;
CREATE POLICY "Authenticated users can view likes"
ON public.news_comment_likes FOR SELECT TO authenticated USING (true);