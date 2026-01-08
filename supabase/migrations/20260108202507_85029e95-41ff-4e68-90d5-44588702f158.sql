-- Fix security warnings: Add SET search_path to functions that are missing it

-- Fix update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Fix update_group_member_count
CREATE OR REPLACE FUNCTION public.update_group_member_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.resident_groups SET member_count = member_count + 1 WHERE id = NEW.group_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.resident_groups SET member_count = member_count - 1 WHERE id = OLD.group_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

-- Fix update_live_likes_count
CREATE OR REPLACE FUNCTION public.update_live_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.lives SET likes_count = likes_count + 1 WHERE id = NEW.live_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.lives SET likes_count = likes_count - 1 WHERE id = OLD.live_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

-- Fix update_followers_count
CREATE OR REPLACE FUNCTION public.update_followers_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.doctor_profiles SET followers_count = followers_count + 1 WHERE user_id = NEW.followed_id;
        UPDATE public.resident_profiles SET followers_count = followers_count + 1 WHERE user_id = NEW.followed_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.doctor_profiles SET followers_count = followers_count - 1 WHERE user_id = OLD.followed_id;
        UPDATE public.resident_profiles SET followers_count = followers_count - 1 WHERE user_id = OLD.followed_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;