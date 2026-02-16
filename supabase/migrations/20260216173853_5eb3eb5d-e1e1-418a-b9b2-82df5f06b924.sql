
-- Add parent_comment_id for threaded replies
ALTER TABLE public.news_comments 
ADD COLUMN parent_comment_id uuid REFERENCES public.news_comments(id) ON DELETE CASCADE;

-- Index for efficient thread queries
CREATE INDEX idx_news_comments_parent ON public.news_comments(parent_comment_id);
