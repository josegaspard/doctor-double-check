-- 1. Add daily_room_name column to lives table
ALTER TABLE public.lives ADD COLUMN IF NOT EXISTS daily_room_name TEXT;

-- 2. Create increment_viewer_count RPC function
CREATE OR REPLACE FUNCTION public.increment_viewer_count(p_live_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.lives
  SET viewer_count = viewer_count + 1
  WHERE id = p_live_id;
END;
$$;

-- 3. Create decrement_viewer_count RPC function
CREATE OR REPLACE FUNCTION public.decrement_viewer_count(p_live_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.lives
  SET viewer_count = GREATEST(0, viewer_count - 1)
  WHERE id = p_live_id;
END;
$$;

-- 4. Update handle_new_user to create wallet for doctors too
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _role public.app_role;
    _name TEXT;
BEGIN
    -- Get role and name from metadata
    _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'patient');
    _name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
    
    -- Create profile
    INSERT INTO public.profiles (id, email, name, avatar_url)
    VALUES (NEW.id, NEW.email, _name, NEW.raw_user_meta_data->>'avatar_url');
    
    -- Create role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, _role);
    
    -- Create wallet for patients, residents AND doctors (for pending_earnings)
    IF _role IN ('patient', 'resident', 'doctor') THEN
        INSERT INTO public.wallets (user_id, balance)
        VALUES (NEW.id, 0);
    END IF;
    
    -- Create doctor profile if applicable
    IF _role = 'doctor' THEN
        INSERT INTO public.doctor_profiles (user_id, specialty, license, status)
        VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'specialty', 'General'),
            COALESCE(NEW.raw_user_meta_data->>'license', ''),
            'pending'
        );
    END IF;
    
    -- Create resident profile if applicable
    IF _role = 'resident' THEN
        INSERT INTO public.resident_profiles (user_id, institution, specialty, year, status)
        VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'institution', ''),
            COALESCE(NEW.raw_user_meta_data->>'specialty', 'General'),
            COALESCE((NEW.raw_user_meta_data->>'year')::INTEGER, 1),
            'pending'
        );
    END IF;
    
    RETURN NEW;
END;
$$;