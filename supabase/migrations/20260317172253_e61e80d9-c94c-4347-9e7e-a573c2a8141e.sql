-- Drop duplicate trigger
DROP TRIGGER IF EXISTS on_live_like_change ON public.live_likes;

-- Recreate function with SECURITY DEFINER so it can update lives through RLS
CREATE OR REPLACE FUNCTION public.update_live_likes_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.lives SET likes_count = likes_count + 1 WHERE id = NEW.live_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.lives SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.live_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$function$;

-- Resync all likes_count from actual data
UPDATE public.lives l
SET likes_count = COALESCE(sub.cnt, 0)
FROM (
  SELECT live_id, COUNT(*) as cnt
  FROM public.live_likes
  GROUP BY live_id
) sub
WHERE l.id = sub.live_id
  AND l.likes_count != sub.cnt;

-- Also reset any lives with likes_count > 0 but no actual likes
UPDATE public.lives
SET likes_count = 0
WHERE likes_count > 0
  AND id NOT IN (SELECT DISTINCT live_id FROM public.live_likes);