
ALTER TABLE medical_news ADD COLUMN view_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION increment_news_view(news_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE medical_news SET view_count = view_count + 1 WHERE id = news_id AND is_published = true;
$$;
