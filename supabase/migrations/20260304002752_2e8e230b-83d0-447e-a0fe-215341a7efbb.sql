CREATE TABLE public.news_comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  comment_id uuid NOT NULL REFERENCES public.news_comments(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, comment_id)
);

ALTER TABLE public.news_comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can like" ON public.news_comment_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike" ON public.news_comment_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Anyone can read likes" ON public.news_comment_likes FOR SELECT USING (true);