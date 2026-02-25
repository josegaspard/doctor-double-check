-- ================================================================
-- DROP existing triggers to avoid conflicts, then recreate all
-- ================================================================

DROP TRIGGER IF EXISTS trg_update_followers_count ON public.followers;
DROP TRIGGER IF EXISTS trg_update_followers_count_on_subscription ON public.subscriptions;
DROP TRIGGER IF EXISTS trg_update_doctor_rating ON public.consultation_ratings;
DROP TRIGGER IF EXISTS trg_update_live_likes_count ON public.live_likes;
DROP TRIGGER IF EXISTS trg_update_group_member_count ON public.resident_group_members;
DROP TRIGGER IF EXISTS trg_validate_chat_message_content ON public.chat_messages;
DROP TRIGGER IF EXISTS trg_update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS trg_update_doctor_profiles_updated_at ON public.doctor_profiles;
DROP TRIGGER IF EXISTS trg_update_resident_profiles_updated_at ON public.resident_profiles;
DROP TRIGGER IF EXISTS trg_update_chat_priority_on_subscription ON public.subscriptions;
DROP TRIGGER IF EXISTS trg_update_site_settings_timestamp ON public.site_settings;
DROP TRIGGER IF EXISTS trg_update_total_consultations ON public.consultations;

-- ================================================================
-- CREATE ALL TRIGGERS
-- ================================================================

CREATE TRIGGER trg_update_followers_count
AFTER INSERT OR DELETE ON public.followers
FOR EACH ROW EXECUTE FUNCTION public.update_followers_count();

CREATE TRIGGER trg_update_followers_count_on_subscription
AFTER INSERT OR UPDATE OR DELETE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_followers_count_on_subscription();

CREATE TRIGGER trg_update_doctor_rating
AFTER INSERT OR UPDATE OR DELETE ON public.consultation_ratings
FOR EACH ROW EXECUTE FUNCTION public.update_doctor_rating();

CREATE TRIGGER trg_update_live_likes_count
AFTER INSERT OR DELETE ON public.live_likes
FOR EACH ROW EXECUTE FUNCTION public.update_live_likes_count();

CREATE TRIGGER trg_update_group_member_count
AFTER INSERT OR DELETE ON public.resident_group_members
FOR EACH ROW EXECUTE FUNCTION public.update_group_member_count();

CREATE TRIGGER trg_validate_chat_message_content
BEFORE INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.validate_chat_message_content();

CREATE TRIGGER trg_update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_update_doctor_profiles_updated_at
BEFORE UPDATE ON public.doctor_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_update_resident_profiles_updated_at
BEFORE UPDATE ON public.resident_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_update_chat_priority_on_subscription
AFTER INSERT OR UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_chat_priority_on_subscription_change();

CREATE TRIGGER trg_update_site_settings_timestamp
BEFORE UPDATE ON public.site_settings
FOR EACH ROW EXECUTE FUNCTION public.update_site_settings_timestamp();

-- ================================================================
-- NEW: total_consultations trigger
-- ================================================================
CREATE OR REPLACE FUNCTION public.update_total_consultations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
      UPDATE public.doctor_profiles
      SET total_consultations = (
        SELECT COUNT(*) FROM public.consultations
        WHERE doctor_id = NEW.doctor_id AND status = 'completed'
      )
      WHERE user_id = NEW.doctor_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_update_total_consultations
AFTER UPDATE ON public.consultations
FOR EACH ROW EXECUTE FUNCTION public.update_total_consultations();

-- ================================================================
-- SYNC EXISTING DATA
-- ================================================================

UPDATE public.doctor_profiles dp
SET followers_count = (
  SELECT COUNT(DISTINCT source_id) FROM (
    SELECT follower_id AS source_id FROM public.followers WHERE followed_id = dp.user_id
    UNION ALL
    SELECT subscriber_id AS source_id FROM public.subscriptions WHERE creator_id = dp.user_id AND is_active = true
  ) combined
);

UPDATE public.resident_profiles rp
SET followers_count = (
  SELECT COUNT(DISTINCT source_id) FROM (
    SELECT follower_id AS source_id FROM public.followers WHERE followed_id = rp.user_id
    UNION ALL
    SELECT subscriber_id AS source_id FROM public.subscriptions WHERE creator_id = rp.user_id AND is_active = true
  ) combined
);

UPDATE public.doctor_profiles dp
SET total_consultations = (
  SELECT COUNT(*) FROM public.consultations
  WHERE doctor_id = dp.user_id AND status = 'completed'
);

UPDATE public.doctor_profiles dp
SET rating = COALESCE((
  SELECT ROUND(AVG(r.rating)::numeric, 1)
  FROM public.consultation_ratings r
  WHERE r.doctor_id = dp.user_id
), 0);

UPDATE public.lives l
SET likes_count = (
  SELECT COUNT(*) FROM public.live_likes WHERE live_id = l.id
);

UPDATE public.resident_groups rg
SET member_count = (
  SELECT COUNT(*) FROM public.resident_group_members WHERE group_id = rg.id
);