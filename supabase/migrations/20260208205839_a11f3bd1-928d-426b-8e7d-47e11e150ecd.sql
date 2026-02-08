-- FIX CRITICAL: Prevent admin role registration via signup metadata
-- The handle_new_user trigger must reject 'admin' role from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    _role public.app_role;
    _name TEXT;
BEGIN
    -- Get role from metadata, but NEVER allow 'admin' from signup
    -- Admin accounts must be created through other means (manual DB insert)
    _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'patient');
    
    -- SECURITY: Block admin role from self-registration
    IF _role = 'admin' THEN
        _role := 'patient';
    END IF;
    
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