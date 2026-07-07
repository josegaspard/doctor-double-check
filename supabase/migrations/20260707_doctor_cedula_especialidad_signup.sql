-- Cédula de especialista en el REGISTRO/ONBOARDING del doctor (cliente 2026-07-07)
-- ────────────────────────────────────────────────────────────────────────────
-- 1) Asegura las columnas de cédula de especialista en doctor_profiles.
--    (La migración 20260506150636 que las definía NUNCA se aplicó a prod → el
--     DoctorCredentialsCard quedaba muerto porque su SELECT fallaba. Esto lo
--     arregla además de habilitar la captura en el alta.)
ALTER TABLE public.doctor_profiles
  ADD COLUMN IF NOT EXISTS cedula_especialidad text,
  ADD COLUMN IF NOT EXISTS cedula_especialidad_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS cedula_especialidad_rejection_reason text;

-- 2) handle_new_user: guarda también cedula_especialidad desde el metadata del
--    signup para los doctores (status 'pending' solo si se capturó, si no NULL).
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
    _role public.app_role;
    _name TEXT;
    _ced_esp TEXT;
BEGIN
    _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'patient');
    IF _role = 'admin' THEN
        _role := 'patient';
    END IF;

    _name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
    _ced_esp := NULLIF(NEW.raw_user_meta_data->>'cedula_especialidad','');

    -- Profile (+ optional referring doctor code from signup)
    INSERT INTO public.profiles (id, email, name, avatar_url, referred_by_doctor_code)
    VALUES (
        NEW.id, NEW.email, _name,
        NEW.raw_user_meta_data->>'avatar_url',
        NULLIF(NEW.raw_user_meta_data->>'doctor_code','')
    );

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, _role);

    IF _role IN ('patient', 'resident', 'doctor') THEN
        INSERT INTO public.wallets (user_id, balance)
        VALUES (NEW.id, 0);
    END IF;

    -- Doctor profile: cédula profesional + cédula de especialista, universidad, hospital y país
    IF _role = 'doctor' THEN
        INSERT INTO public.doctor_profiles (
            user_id, specialty, license, status,
            cedula_profesional, cedula_especialidad, cedula_especialidad_status,
            university, practice_hospital, country
        )
        VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'specialty', 'General'),
            COALESCE(NEW.raw_user_meta_data->>'license', ''),
            'pending',
            NULLIF(NEW.raw_user_meta_data->>'cedula_profesional',''),
            _ced_esp,
            CASE WHEN _ced_esp IS NOT NULL THEN 'pending' ELSE NULL END,
            NULLIF(NEW.raw_user_meta_data->>'university',''),
            NULLIF(NEW.raw_user_meta_data->>'hospital',''),
            NULLIF(NEW.raw_user_meta_data->>'country','')
        );
    END IF;

    -- Resident profile
    IF _role = 'resident' THEN
        INSERT INTO public.resident_profiles (
            user_id, institution, specialty, year, status, cedula_profesional
        )
        VALUES (
            NEW.id,
            COALESCE(
                NULLIF(NEW.raw_user_meta_data->>'institution',''),
                NULLIF(NEW.raw_user_meta_data->>'university',''),
                NULLIF(NEW.raw_user_meta_data->>'hospital',''),
                ''
            ),
            COALESCE(NEW.raw_user_meta_data->>'specialty', 'General'),
            COALESCE(NULLIF(NEW.raw_user_meta_data->>'year','')::INTEGER, 1),
            'pending',
            NULLIF(NEW.raw_user_meta_data->>'cedula_profesional','')
        );
    END IF;

    RETURN NEW;
END;
$function$;
