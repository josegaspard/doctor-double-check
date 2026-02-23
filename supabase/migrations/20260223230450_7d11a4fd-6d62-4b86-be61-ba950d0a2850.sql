
-- Create trigger to update followers_count when subscriptions change
CREATE OR REPLACE FUNCTION public.update_followers_count_on_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.doctor_profiles SET followers_count = followers_count + 1 WHERE user_id = NEW.creator_id;
        UPDATE public.resident_profiles SET followers_count = followers_count + 1 WHERE user_id = NEW.creator_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.doctor_profiles SET followers_count = followers_count - 1 WHERE user_id = OLD.creator_id;
        UPDATE public.resident_profiles SET followers_count = followers_count - 1 WHERE user_id = OLD.creator_id;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Handle is_active toggling
        IF OLD.is_active = true AND NEW.is_active = false THEN
            UPDATE public.doctor_profiles SET followers_count = GREATEST(0, followers_count - 1) WHERE user_id = NEW.creator_id;
            UPDATE public.resident_profiles SET followers_count = GREATEST(0, followers_count - 1) WHERE user_id = NEW.creator_id;
        ELSIF OLD.is_active = false AND NEW.is_active = true THEN
            UPDATE public.doctor_profiles SET followers_count = followers_count + 1 WHERE user_id = NEW.creator_id;
            UPDATE public.resident_profiles SET followers_count = followers_count + 1 WHERE user_id = NEW.creator_id;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$function$;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS on_subscription_change_update_followers ON public.subscriptions;

-- Create trigger
CREATE TRIGGER on_subscription_change_update_followers
AFTER INSERT OR UPDATE OR DELETE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_followers_count_on_subscription();

-- Sync current followers_count from active subscriptions
UPDATE public.doctor_profiles dp
SET followers_count = COALESCE(sub_counts.cnt, 0)
FROM (
    SELECT creator_id, COUNT(*) as cnt
    FROM public.subscriptions
    WHERE is_active = true
    GROUP BY creator_id
) sub_counts
WHERE dp.user_id = sub_counts.creator_id;
