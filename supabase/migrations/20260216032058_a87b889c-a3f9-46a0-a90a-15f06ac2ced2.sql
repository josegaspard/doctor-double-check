
-- Add slug column to medical_news for SEO-friendly URLs
ALTER TABLE public.medical_news ADD COLUMN IF NOT EXISTS slug text UNIQUE;

-- Create news_comments table
CREATE TABLE public.news_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  news_id uuid NOT NULL REFERENCES public.medical_news(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.news_comments ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read comments
CREATE POLICY "Anyone can view comments"
ON public.news_comments
FOR SELECT
USING (true);

-- Users can create own comments
CREATE POLICY "Users can create own comments"
ON public.news_comments
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update own comments
CREATE POLICY "Users can update own comments"
ON public.news_comments
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete own comments
CREATE POLICY "Users can delete own comments"
ON public.news_comments
FOR DELETE
USING (auth.uid() = user_id);

-- Admins can manage all comments
CREATE POLICY "Admins can manage all comments"
ON public.news_comments
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Index for performance
CREATE INDEX idx_news_comments_news_id ON public.news_comments(news_id);
CREATE INDEX idx_news_comments_created_at ON public.news_comments(created_at DESC);

-- Add trigger for updated_at
CREATE TRIGGER update_news_comments_updated_at
BEFORE UPDATE ON public.news_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update medical_news admin policies to ensure admins can manage
-- (already has admin access via created_by check but let's make it explicit)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'medical_news' AND policyname = 'Admins can manage all news'
  ) THEN
    CREATE POLICY "Admins can manage all news"
    ON public.medical_news
    FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;
