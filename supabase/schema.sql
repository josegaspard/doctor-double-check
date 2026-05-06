--
-- PostgreSQL database dump
--

\restrict MGHWYAcBCMLQnAtPOt1Q6uC5NaNgdD3fODiq5gptKtDFphi1AwbXGXoa6Z8flog

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'SQL_ASCII';
SET standard_conforming_strings = off;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET escape_string_warning = off;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'visitor',
    'patient',
    'doctor',
    'resident',
    'admin'
);


--
-- Name: availability_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.availability_status AS ENUM (
    'scheduled',
    'confirmed',
    'cancelled',
    'completed'
);


--
-- Name: chat_participant_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.chat_participant_type AS ENUM (
    'patient',
    'doctor',
    'resident'
);


--
-- Name: chat_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.chat_status AS ENUM (
    'active',
    'closed'
);


--
-- Name: clinical_session_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.clinical_session_status AS ENUM (
    'pending',
    'accepted',
    'rejected',
    'completed',
    'cancelled'
);


--
-- Name: content_audience; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.content_audience AS ENUM (
    'all',
    'patients',
    'professionals',
    'subscribers'
);


--
-- Name: content_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.content_type AS ENUM (
    'video',
    'pdf',
    'image',
    'presentation'
);


--
-- Name: doctor_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.doctor_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);


--
-- Name: identity_verification_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.identity_verification_status AS ENUM (
    'pending',
    'in_progress',
    'verified',
    'failed',
    'expired'
);


--
-- Name: live_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.live_status AS ENUM (
    'live',
    'ended',
    'processing_recording',
    'recording_ready'
);


--
-- Name: notification_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_type AS ENUM (
    'doctor_live',
    'doctor_availability',
    'new_content',
    'subscription_update',
    'chat_message',
    'system',
    'rating_request',
    'video_call'
);


--
-- Name: subscription_tier; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscription_tier AS ENUM (
    'free',
    'basic',
    'premium'
);


--
-- Name: supported_language; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.supported_language AS ENUM (
    'es',
    'en'
);


--
-- Name: transaction_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.transaction_status AS ENUM (
    'initiated',
    'paid',
    'failed'
);


--
-- Name: transaction_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.transaction_type AS ENUM (
    'topup',
    'purchase',
    'refund',
    'subscription',
    'earning'
);


--
-- Name: vault_file_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.vault_file_type AS ENUM (
    'pdf',
    'image',
    'study'
);


--
-- Name: verification_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.verification_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);


--
-- Name: credit_doctor_earnings(uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.credit_doctor_earnings(p_doctor_id uuid, p_amount numeric) RETURNS numeric
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_new_pending NUMERIC;
BEGIN
  UPDATE doctor_profiles
  SET pending_earnings = COALESCE(pending_earnings, 0) + p_amount
  WHERE user_id = p_doctor_id
  RETURNING pending_earnings INTO v_new_pending;

  IF NOT FOUND THEN
    RETURN -1;
  END IF;

  RETURN v_new_pending;
END;
$$;


--
-- Name: credit_wallet_balance(uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.credit_wallet_balance(p_user_id uuid, p_amount numeric) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE wallets
  SET balance = balance + p_amount,
      updated_at = now()
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found for user %', p_user_id;
  END IF;
END;
$$;


--
-- Name: decrement_storage_used(uuid, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.decrement_storage_used(p_user_id uuid, p_bytes bigint) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.profiles
  SET storage_used_bytes = GREATEST(0, storage_used_bytes - p_bytes)
  WHERE id = p_user_id;
END;
$$;


--
-- Name: decrement_viewer_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.decrement_viewer_count(p_live_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to count viewers';
  END IF;
  UPDATE public.lives
  SET viewer_count = GREATEST(0, viewer_count - 1)
  WHERE id = p_live_id;
END;
$$;


--
-- Name: get_chat_session_details(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_chat_session_details(p_session_id uuid) RETURNS TABLE(session_id uuid, participant1_id uuid, participant1_name text, participant1_type public.chat_participant_type, participant1_specialty text, participant1_avatar text, participant2_id uuid, participant2_name text, participant2_type public.chat_participant_type, participant2_specialty text, participant2_avatar text, doctor_office_hours_start time without time zone, doctor_office_hours_end time without time zone, doctor_office_days text[])
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    cs.id as session_id,
    cs.participant1_id,
    p1.name as participant1_name,
    cs.participant1_type,
    COALESCE(dp1.specialty, rp1.specialty) as participant1_specialty,
    p1.avatar_url as participant1_avatar,
    cs.participant2_id,
    p2.name as participant2_name,
    cs.participant2_type,
    COALESCE(dp2.specialty, rp2.specialty) as participant2_specialty,
    p2.avatar_url as participant2_avatar,
    COALESCE(dp1.office_hours_start, dp2.office_hours_start) as doctor_office_hours_start,
    COALESCE(dp1.office_hours_end, dp2.office_hours_end) as doctor_office_hours_end,
    COALESCE(dp1.office_days, dp2.office_days) as doctor_office_days
  FROM public.chat_sessions cs
  LEFT JOIN public.profiles p1 ON p1.id = cs.participant1_id
  LEFT JOIN public.profiles p2 ON p2.id = cs.participant2_id
  LEFT JOIN public.doctor_profiles dp1 ON dp1.user_id = cs.participant1_id
  LEFT JOIN public.doctor_profiles dp2 ON dp2.user_id = cs.participant2_id
  LEFT JOIN public.resident_profiles rp1 ON rp1.user_id = cs.participant1_id
  LEFT JOIN public.resident_profiles rp2 ON rp2.user_id = cs.participant2_id
  WHERE cs.id = p_session_id
    AND (cs.participant1_id = auth.uid() OR cs.participant2_id = auth.uid())
  LIMIT 1;
$$;


--
-- Name: get_chat_sessions_details_bulk(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_chat_sessions_details_bulk(p_session_ids uuid[]) RETURNS TABLE(session_id uuid, participant1_id uuid, participant1_name text, participant1_type public.chat_participant_type, participant1_specialty text, participant1_avatar text, participant2_id uuid, participant2_name text, participant2_type public.chat_participant_type, participant2_specialty text, participant2_avatar text, doctor_office_hours_start time without time zone, doctor_office_hours_end time without time zone, doctor_office_days text[])
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    cs.id as session_id,
    cs.participant1_id,
    p1.name as participant1_name,
    cs.participant1_type,
    COALESCE(dp1.specialty, rp1.specialty) as participant1_specialty,
    p1.avatar_url as participant1_avatar,
    cs.participant2_id,
    p2.name as participant2_name,
    cs.participant2_type,
    COALESCE(dp2.specialty, rp2.specialty) as participant2_specialty,
    p2.avatar_url as participant2_avatar,
    COALESCE(dp1.office_hours_start, dp2.office_hours_start) as doctor_office_hours_start,
    COALESCE(dp1.office_hours_end, dp2.office_hours_end) as doctor_office_hours_end,
    COALESCE(dp1.office_days, dp2.office_days) as doctor_office_days
  FROM public.chat_sessions cs
  LEFT JOIN public.profiles p1 ON p1.id = cs.participant1_id
  LEFT JOIN public.profiles p2 ON p2.id = cs.participant2_id
  LEFT JOIN public.doctor_profiles dp1 ON dp1.user_id = cs.participant1_id
  LEFT JOIN public.doctor_profiles dp2 ON dp2.user_id = cs.participant2_id
  LEFT JOIN public.resident_profiles rp1 ON rp1.user_id = cs.participant1_id
  LEFT JOIN public.resident_profiles rp2 ON rp2.user_id = cs.participant2_id
  WHERE cs.id = ANY(p_session_ids)
    AND (cs.participant1_id = auth.uid() OR cs.participant2_id = auth.uid());
$$;


--
-- Name: get_doctor_accessible_files(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_doctor_accessible_files(p_doctor_id uuid DEFAULT auth.uid()) RETURNS TABLE(id uuid, patient_id uuid, name text, file_type public.vault_file_type, file_url text, file_size integer, category text, description text, created_at timestamp with time zone, granted_at timestamp with time zone, expires_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    vf.id,
    vf.patient_id,
    vf.name,
    vf.file_type,
    vf.file_url,
    vf.file_size,
    vf.category,
    vf.description,
    vf.created_at,
    va.granted_at,
    va.expires_at
  FROM public.vault_files vf
  INNER JOIN public.vault_access va
    ON va.file_id = vf.id
   AND va.doctor_id = p_doctor_id
   AND (va.expires_at IS NULL OR va.expires_at > now())
  WHERE p_doctor_id = auth.uid()
  ORDER BY vf.created_at DESC;
$$;


--
-- Name: get_doctor_public_profile(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_doctor_public_profile(p_user_id uuid) RETURNS TABLE(user_id uuid, profile_id uuid, name text, avatar_url text, specialty text, status public.doctor_status, rating numeric, total_consultations integer, consultation_fee numeric, followers_count integer, location text, bio text, office_hours_start time without time zone, office_hours_end time without time zone, office_days text[], country_code text, country_flag text, is_identity_verified boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    dp.user_id,
    dp.id as profile_id,
    p.name,
    p.avatar_url,
    dp.specialty,
    dp.status,
    dp.rating,
    dp.total_consultations,
    dp.consultation_fee,
    dp.followers_count,
    dp.location,
    dp.bio,
    dp.office_hours_start,
    dp.office_hours_end,
    dp.office_days,
    p.country_code,
    p.country_flag,
    COALESCE(p.is_identity_verified, false) as is_identity_verified
  FROM public.doctor_profiles dp
  JOIN public.profiles p ON p.id = dp.user_id
  WHERE dp.user_id = p_user_id
    AND dp.status = 'approved'
  LIMIT 1;
$$;


--
-- Name: get_doctor_signature(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_doctor_signature(p_doctor_user_id uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT signature_url
  FROM public.doctor_profiles
  WHERE user_id = p_doctor_user_id
  LIMIT 1;
$$;


--
-- Name: get_doctors_paginated(integer, integer, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_doctors_paginated(p_page integer DEFAULT 1, p_page_size integer DEFAULT 20, p_search text DEFAULT ''::text, p_specialty text DEFAULT ''::text, p_location text DEFAULT ''::text) RETURNS TABLE(id uuid, user_id uuid, specialty text, bio text, rating numeric, followers_count integer, consultation_fee numeric, total_consultations integer, location text, available_for_double_check boolean, badge_override text, office_hours_start time without time zone, office_hours_end time without time zone, office_days text[], name text, avatar_url text, is_identity_verified boolean, total_count bigint, country_code text, country_flag text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH filtered AS (
    SELECT
      dp.id,
      dp.user_id,
      dp.specialty,
      dp.bio,
      dp.rating,
      dp.followers_count,
      dp.consultation_fee,
      dp.total_consultations,
      dp.location,
      dp.available_for_double_check,
      dp.badge_override,
      dp.office_hours_start,
      dp.office_hours_end,
      dp.office_days,
      p.name,
      p.avatar_url,
      p.is_identity_verified,
      p.country_code,
      p.country_flag
    FROM public.doctor_profiles dp
    JOIN public.profiles p ON p.id = dp.user_id
    WHERE dp.status = 'approved'
      AND (
        p_search = '' OR
        p.name ILIKE '%' || replace(replace(left(p_search, 100), '%', '\%'), '_', '\_') || '%' ESCAPE '\'
        OR dp.specialty ILIKE '%' || replace(replace(left(p_search, 100), '%', '\%'), '_', '\_') || '%' ESCAPE '\'
      )
      AND (
        p_specialty = '' OR p_specialty = 'Todas' OR dp.specialty = p_specialty
      )
      AND (
        p_location = '' OR dp.location ILIKE '%' || replace(replace(left(p_location, 100), '%', '\%'), '_', '\_') || '%' ESCAPE '\'
      )
  ),
  cnt AS (
    SELECT count(*) AS total_count FROM filtered
  )
  SELECT
    f.id, f.user_id, f.specialty, f.bio, f.rating, f.followers_count,
    f.consultation_fee, f.total_consultations, f.location,
    f.available_for_double_check, f.badge_override,
    f.office_hours_start, f.office_hours_end, f.office_days,
    f.name, f.avatar_url, f.is_identity_verified,
    cnt.total_count,
    f.country_code, f.country_flag
  FROM filtered f, cnt
  ORDER BY f.rating DESC NULLS LAST, f.followers_count DESC NULLS LAST, f.id
  LIMIT LEAST(p_page_size, 20)
  OFFSET (GREATEST(p_page, 1) - 1) * LEAST(p_page_size, 20);
$$;


--
-- Name: get_my_subscribers(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_subscribers() RETURNS TABLE(subscriber_id uuid, name text, avatar_url text, email text, tier public.subscription_tier, price_paid numeric, is_active boolean, created_at timestamp with time zone, expires_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    s.subscriber_id,
    p.name,
    p.avatar_url,
    p.email,
    s.tier,
    s.price_paid,
    s.is_active,
    s.created_at,
    s.expires_at
  FROM public.subscriptions s
  JOIN public.profiles p ON p.id = s.subscriber_id
  WHERE s.creator_id = auth.uid()
  ORDER BY s.is_active DESC, s.created_at DESC;
$$;


--
-- Name: get_price_for_user(numeric, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_price_for_user(_base_price numeric, _user_id uuid) RETURNS numeric
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT CASE 
        WHEN public.has_role(_user_id, 'resident') THEN _base_price * 0.5
        ELSE _base_price
    END
$$;


--
-- Name: get_subscription_priority(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_subscription_priority(p_subscriber_id uuid, p_creator_id uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT CASE 
    WHEN EXISTS (
      SELECT 1 FROM subscriptions 
      WHERE subscriber_id = p_subscriber_id 
        AND creator_id = p_creator_id 
        AND is_active = true 
        AND tier = 'premium'
    ) THEN 100
    WHEN EXISTS (
      SELECT 1 FROM subscriptions 
      WHERE subscriber_id = p_subscriber_id 
        AND creator_id = p_creator_id 
        AND is_active = true 
        AND tier = 'basic'
    ) THEN 50
    ELSE 0
  END;
$$;


--
-- Name: get_user_role(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_role(_user_id uuid) RETURNS public.app_role
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT role
    FROM public.user_roles
    WHERE user_id = _user_id
    LIMIT 1
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
        AND role = _role
    )
$$;


--
-- Name: increment_news_view(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_news_view(news_id uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  UPDATE medical_news SET view_count = view_count + 1 WHERE id = news_id AND is_published = true;
$$;


--
-- Name: increment_paid_chats_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_paid_chats_count(p_live_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.lives
  SET paid_chats_count = paid_chats_count + 1
  WHERE id = p_live_id;
END;
$$;


--
-- Name: increment_storage_used(uuid, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_storage_used(p_user_id uuid, p_bytes bigint) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.profiles
  SET storage_used_bytes = storage_used_bytes + p_bytes
  WHERE id = p_user_id;
END;
$$;


--
-- Name: increment_viewer_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_viewer_count(p_live_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to count viewers';
  END IF;
  UPDATE public.lives
  SET viewer_count = viewer_count + 1
  WHERE id = p_live_id;
END;
$$;


--
-- Name: is_approved_doctor(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_approved_doctor(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.doctor_profiles
        WHERE user_id = _user_id
        AND status = 'approved'
    )
$$;


--
-- Name: is_approved_resident(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_approved_resident(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.resident_profiles
        WHERE user_id = _user_id
        AND status = 'approved'
    )
$$;


--
-- Name: log_vault_action(uuid, uuid, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_vault_action(p_file_id uuid, p_patient_id uuid, p_action text, p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.vault_audit_log(file_id, actor_id, patient_id, action, metadata)
  VALUES (p_file_id, auth.uid(), p_patient_id, p_action, COALESCE(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;


--
-- Name: notify_subscribers(uuid, public.notification_type, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_subscribers(p_doctor_id uuid, p_notification_type public.notification_type, p_title text, p_message text, p_data jsonb DEFAULT '{}'::jsonb) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- Validate caller is the doctor or admin
  IF p_doctor_id != auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: can only notify own subscribers';
  END IF;

  -- Insert notifications for all active subscribers of the doctor
  INSERT INTO public.notifications (user_id, type, title, message, data)
  SELECT 
    s.subscriber_id,
    p_notification_type,
    p_title,
    p_message,
    p_data
  FROM public.subscriptions s
  WHERE s.creator_id = p_doctor_id
    AND s.is_active = true
    AND (
      (p_notification_type = 'doctor_live' AND s.notify_on_live = true) OR
      (p_notification_type = 'new_content' AND s.notify_on_content = true) OR
      (p_notification_type = 'doctor_availability' AND s.notify_on_availability = true) OR
      p_notification_type NOT IN ('doctor_live', 'new_content', 'doctor_availability')
    );
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


--
-- Name: notify_wallet_status_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_wallet_status_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'paid' AND OLD.status IN ('initiated','pending') THEN
      INSERT INTO public.notifications(user_id, type, title, message, data)
      VALUES (NEW.user_id, 'system', '✅ Pago confirmado',
              COALESCE(NEW.description, 'Tu pago ha sido confirmado.'),
              jsonb_build_object('transaction_id', NEW.id, 'amount', NEW.amount, 'status', 'paid'));
    ELSIF NEW.status = 'failed' AND OLD.status IN ('initiated','pending') THEN
      INSERT INTO public.notifications(user_id, type, title, message, data)
      VALUES (NEW.user_id, 'system', '❌ Pago rechazado',
              COALESCE(NEW.description, 'Tu pago no se pudo procesar') || ' — intenta de nuevo o contacta soporte.',
              jsonb_build_object('transaction_id', NEW.id, 'amount', NEW.amount, 'status', 'failed'));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: process_consultation_purchase(uuid, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_consultation_purchase(p_doctor_id uuid, p_amount numeric, p_patient_name text DEFAULT 'Paciente'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id UUID;
  v_current_balance DECIMAL;
  v_final_amount DECIMAL;
  v_chat_session_id UUID;
  v_consultation_id UUID;
  v_user_role app_role;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No authenticated user');
  END IF;
  
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;
  
  SELECT role INTO v_user_role FROM user_roles WHERE user_id = v_user_id LIMIT 1;
  
  SELECT balance INTO v_current_balance 
  FROM wallets 
  WHERE user_id = v_user_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;
  
  v_final_amount := get_price_for_user(p_amount, v_user_id);
  
  IF v_current_balance < v_final_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;
  
  SELECT id INTO v_chat_session_id
  FROM chat_sessions
  WHERE ((participant1_id = v_user_id AND participant2_id = p_doctor_id)
     OR (participant1_id = p_doctor_id AND participant2_id = v_user_id))
    AND status = 'active'
    AND is_double_check = false
  LIMIT 1;
  
  IF v_chat_session_id IS NULL THEN
    INSERT INTO chat_sessions (
      participant1_id, participant1_type, participant2_id, participant2_type, status, is_double_check
    )
    VALUES (
      v_user_id, COALESCE(v_user_role::text, 'patient')::chat_participant_type, p_doctor_id, 'doctor', 'active', false
    )
    RETURNING id INTO v_chat_session_id;
  END IF;
  
  INSERT INTO consultations (patient_id, doctor_id, chat_session_id, status)
  VALUES (v_user_id, p_doctor_id, v_chat_session_id, 'active')
  RETURNING id INTO v_consultation_id;
  
  INSERT INTO wallet_transactions (user_id, type, amount, description, status, metadata)
  VALUES (v_user_id, 'purchase', -v_final_amount, 'Consulta médica por chat', 'paid', 
          jsonb_build_object('doctor_id', p_doctor_id, 'type', 'consultation', 'consultation_id', v_consultation_id, 'session_id', v_chat_session_id));
  
  UPDATE wallets 
  SET balance = balance - v_final_amount, updated_at = now()
  WHERE user_id = v_user_id;
  
  -- UPSERT: renew entitlement if it already exists instead of failing
  INSERT INTO entitlements (user_id, type, is_active, expires_at)
  VALUES (v_user_id, 'chat', true, now() + interval '30 days')
  ON CONFLICT (user_id, type) 
  DO UPDATE SET is_active = true, expires_at = GREATEST(entitlements.expires_at, now()) + interval '30 days';
  
  UPDATE doctor_profiles
  SET pending_earnings = COALESCE(pending_earnings, 0) + v_final_amount
  WHERE user_id = p_doctor_id;
  
  INSERT INTO wallet_transactions (user_id, type, amount, description, status, metadata)
  VALUES (p_doctor_id, 'earning', v_final_amount, 'Ganancia por consulta médica', 'paid',
          jsonb_build_object('patient_id', v_user_id, 'source', 'consultation', 'consultation_id', v_consultation_id));
  
  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (p_doctor_id, 'chat_message', '💬 Nueva consulta pagada',
          p_patient_name || ' ha pagado una consulta contigo',
          jsonb_build_object('patient_id', v_user_id, 'url', '/chat', 'session_id', v_chat_session_id));
  
  RETURN jsonb_build_object(
    'success', true, 
    'amount_charged', v_final_amount, 
    'new_balance', v_current_balance - v_final_amount,
    'session_id', v_chat_session_id,
    'consultation_id', v_consultation_id
  );
END;
$$;


--
-- Name: process_doctor_payout(uuid, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_doctor_payout(p_doctor_id uuid, p_payout_amount numeric, p_gross_amount numeric) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_current_pending NUMERIC;
  v_current_total NUMERIC;
BEGIN
  -- Lock the row to prevent concurrent updates
  SELECT pending_earnings, total_earnings
  INTO v_current_pending, v_current_total
  FROM doctor_profiles
  WHERE user_id = p_doctor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Doctor profile not found');
  END IF;

  IF v_current_pending < p_gross_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient pending earnings');
  END IF;

  -- Atomic update: deduct pending, add to total
  UPDATE doctor_profiles
  SET pending_earnings = pending_earnings - p_gross_amount,
      total_earnings = COALESCE(total_earnings, 0) + p_gross_amount
  WHERE user_id = p_doctor_id;

  RETURN jsonb_build_object(
    'success', true,
    'new_pending', v_current_pending - p_gross_amount,
    'new_total', COALESCE(v_current_total, 0) + p_gross_amount
  );
END;
$$;


--
-- Name: process_wallet_purchase(numeric, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_wallet_purchase(p_amount numeric, p_description text, p_metadata jsonb DEFAULT NULL::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id UUID;
  v_current_balance DECIMAL;
  v_final_amount DECIMAL;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No authenticated user');
  END IF;
  
  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;
  
  -- Get current balance with row lock to prevent race conditions
  SELECT balance INTO v_current_balance 
  FROM wallets 
  WHERE user_id = v_user_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;
  
  -- Calculate price (50% discount for residents)
  v_final_amount := get_price_for_user(p_amount, v_user_id);
  
  -- Check if user can afford
  IF v_current_balance < v_final_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;
  
  -- Create transaction record
  INSERT INTO wallet_transactions (user_id, type, amount, description, status, metadata)
  VALUES (v_user_id, 'purchase', -v_final_amount, p_description, 'paid', p_metadata);
  
  -- Update wallet balance atomically
  UPDATE wallets 
  SET balance = balance - v_final_amount, updated_at = now()
  WHERE user_id = v_user_id;
  
  RETURN jsonb_build_object('success', true, 'amount_charged', v_final_amount, 'new_balance', v_current_balance - v_final_amount);
END;
$$;


--
-- Name: process_wallet_topup(numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_wallet_topup(p_amount numeric) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id UUID;
  v_current_balance DECIMAL;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No authenticated user');
  END IF;
  
  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;
  
  -- Get current balance
  SELECT balance INTO v_current_balance FROM wallets WHERE user_id = v_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;
  
  -- Create transaction record
  INSERT INTO wallet_transactions (user_id, type, amount, description, status)
  VALUES (v_user_id, 'topup', p_amount, 'Recarga de saldo', 'paid');
  
  -- Update wallet balance atomically
  UPDATE wallets 
  SET balance = balance + p_amount, updated_at = now()
  WHERE user_id = v_user_id;
  
  RETURN jsonb_build_object('success', true, 'new_balance', v_current_balance + p_amount);
END;
$$;


--
-- Name: redeem_referral_code(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.redeem_referral_code(p_code text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_user_id UUID;
  v_code_record RECORD;
  v_wallet_bonus NUMERIC := 50; -- $50 MXN bonus for both
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No authenticated');
  END IF;

  -- Check if user already redeemed a code
  IF EXISTS (SELECT 1 FROM referral_redemptions WHERE referred_user_id = v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ya has usado un código de referido');
  END IF;

  -- Find the code
  SELECT * INTO v_code_record FROM referral_codes 
  WHERE code = UPPER(p_code) AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Código inválido o expirado');
  END IF;

  -- Can't use own code
  IF v_code_record.user_id = v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'No puedes usar tu propio código');
  END IF;

  -- Check max uses
  IF v_code_record.max_uses IS NOT NULL AND v_code_record.uses_count >= v_code_record.max_uses THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este código ha alcanzado su límite de usos');
  END IF;

  -- Create redemption
  INSERT INTO referral_redemptions (referral_code_id, referred_user_id, referrer_user_id, discount_applied)
  VALUES (v_code_record.id, v_user_id, v_code_record.user_id, v_wallet_bonus);

  -- Update uses count
  UPDATE referral_codes SET uses_count = uses_count + 1 WHERE id = v_code_record.id;

  -- Add wallet bonus to referred user
  UPDATE wallets SET balance = balance + v_wallet_bonus WHERE user_id = v_user_id;
  INSERT INTO wallet_transactions (user_id, type, amount, description, status)
  VALUES (v_user_id, 'topup', v_wallet_bonus, 'Bono por código de referido', 'paid');

  -- Add wallet bonus to referrer
  UPDATE wallets SET balance = balance + v_wallet_bonus WHERE user_id = v_code_record.user_id;
  INSERT INTO wallet_transactions (user_id, type, amount, description, status)
  VALUES (v_code_record.user_id, 'topup', v_wallet_bonus, 'Bono por referido exitoso', 'paid');

  -- Notify referrer
  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (v_code_record.user_id, 'system', '🎉 ¡Referido exitoso!', 
          'Alguien usó tu código de referido. Se agregaron $50 MXN a tu wallet.',
          jsonb_build_object('type', 'referral_bonus', 'amount', v_wallet_bonus));

  RETURN jsonb_build_object('success', true, 'bonus', v_wallet_bonus);
END;
$_$;


--
-- Name: search_doctors_public(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_doctors_public(p_term text, p_limit integer DEFAULT 8) RETURNS TABLE(user_id uuid, name text, avatar_url text, specialty text, status public.doctor_status, rating numeric, followers_count integer, location text, bio text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    dp.user_id,
    p.name,
    p.avatar_url,
    dp.specialty,
    dp.status,
    dp.rating,
    dp.followers_count,
    dp.location,
    dp.bio
  FROM public.doctor_profiles dp
  JOIN public.profiles p ON p.id = dp.user_id
  WHERE dp.status = 'approved'
    AND (
      p.name ILIKE '%' || replace(replace(left(p_term, 100), '%', '\%'), '_', '\_') || '%' ESCAPE '\'
      OR dp.specialty ILIKE '%' || replace(replace(left(p_term, 100), '%', '\%'), '_', '\_') || '%' ESCAPE '\'
    )
  ORDER BY
    CASE WHEN p.name ILIKE '%' || replace(replace(left(p_term, 100), '%', '\%'), '_', '\_') || '%' ESCAPE '\' THEN 0 ELSE 1 END,
    dp.rating DESC NULLS LAST,
    dp.followers_count DESC NULLS LAST
  LIMIT LEAST(GREATEST(p_limit, 0), 20);
$$;


--
-- Name: search_patients_for_doctor(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_patients_for_doctor(p_term text, p_limit integer DEFAULT 10) RETURNS TABLE(user_id uuid, name text, email text, avatar_url text, country_code text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    p.id as user_id,
    p.name,
    p.email,
    p.avatar_url,
    p.country_code
  FROM public.profiles p
  INNER JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'patient'
  WHERE
    public.is_approved_doctor(auth.uid())
    AND (
      p.name ILIKE '%' || replace(replace(left(p_term, 100), '%', '\%'), '_', '\_') || '%' ESCAPE '\'
      OR p.email ILIKE '%' || replace(replace(left(p_term, 100), '%', '\%'), '_', '\_') || '%' ESCAPE '\'
    )
  ORDER BY
    CASE WHEN p.name ILIKE '%' || replace(replace(left(p_term, 100), '%', '\%'), '_', '\_') || '%' ESCAPE '\' THEN 0 ELSE 1 END,
    p.name
  LIMIT LEAST(GREATEST(p_limit, 1), 20);
$$;


--
-- Name: sync_clinical_case_comments_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_clinical_case_comments_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.clinical_cases SET comments_count = comments_count + 1 WHERE id = NEW.case_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.clinical_cases SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.case_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;


--
-- Name: trg_vault_access_audit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_vault_access_audit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_patient_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT patient_id INTO v_patient_id FROM public.vault_files WHERE id = NEW.file_id;
    INSERT INTO public.vault_audit_log(file_id, actor_id, patient_id, action, metadata)
    VALUES (NEW.file_id, auth.uid(), COALESCE(v_patient_id, NEW.granted_by), 'access_granted',
            jsonb_build_object('doctor_id', NEW.doctor_id, 'expires_at', NEW.expires_at));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT patient_id INTO v_patient_id FROM public.vault_files WHERE id = OLD.file_id;
    INSERT INTO public.vault_audit_log(file_id, actor_id, patient_id, action, metadata)
    VALUES (OLD.file_id, auth.uid(), COALESCE(v_patient_id, OLD.granted_by), 'access_revoked',
            jsonb_build_object('doctor_id', OLD.doctor_id));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;


--
-- Name: update_chat_priority_on_subscription_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_chat_priority_on_subscription_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Update priority_score for all chat sessions where this subscriber is participant
  UPDATE public.chat_sessions cs
  SET priority_score = public.get_subscription_priority(
    CASE WHEN cs.participant1_type = 'patient' THEN cs.participant1_id ELSE cs.participant2_id END,
    CASE WHEN cs.participant1_type = 'doctor' THEN cs.participant1_id ELSE cs.participant2_id END
  )
  WHERE (cs.participant1_id = NEW.subscriber_id OR cs.participant2_id = NEW.subscriber_id)
    AND cs.status = 'active';
  
  RETURN NEW;
END;
$$;


--
-- Name: update_doctor_rating(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_doctor_rating() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.doctor_profiles
  SET rating = COALESCE((
    SELECT ROUND(AVG(r.rating)::numeric, 1)
    FROM public.consultation_ratings r
    WHERE r.doctor_id = COALESCE(NEW.doctor_id, OLD.doctor_id)
  ), 0)
  WHERE user_id = COALESCE(NEW.doctor_id, OLD.doctor_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: update_followers_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_followers_count() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
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


--
-- Name: update_followers_count_on_subscription(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_followers_count_on_subscription() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: update_group_member_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_group_member_count() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
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


--
-- Name: update_live_likes_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_live_likes_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: update_site_settings_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_site_settings_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_total_consultations(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_total_consultations() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


--
-- Name: user_has_vault_access(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_has_vault_access(p_file_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM vault_access va
    WHERE va.file_id = p_file_id
      AND va.doctor_id = p_user_id
      AND (va.expires_at IS NULL OR va.expires_at > now())
  )
$$;


--
-- Name: user_is_clinical_session_participant(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_is_clinical_session_participant(p_session_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM clinical_session_invitations csi
    WHERE csi.session_id = p_session_id
      AND csi.doctor_id = p_user_id
  )
$$;


--
-- Name: user_is_invitation_organizer(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_is_invitation_organizer(p_invitation_session_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM clinical_sessions cs
    WHERE cs.id = p_invitation_session_id
      AND cs.organizer_id = p_user_id
  )
$$;


--
-- Name: validate_chat_message_content(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_chat_message_content() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Ensure content is not empty after trimming
  NEW.content := TRIM(NEW.content);
  
  IF NEW.content IS NULL OR LENGTH(NEW.content) = 0 THEN
    RAISE EXCEPTION 'Message content cannot be empty';
  END IF;
  
  -- Limit message length to 10000 characters to prevent DoS
  IF LENGTH(NEW.content) > 10000 THEN
    RAISE EXCEPTION 'Message content exceeds maximum length of 10000 characters';
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: validate_refund_request_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_refund_request_status() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'approved', 'rejected', 'processed', 'pending_transfer', 'transferred', 'completed', 'awaiting_bank_details') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ad_campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ad_campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    advertiser_id uuid NOT NULL,
    name text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    budget numeric DEFAULT 0 NOT NULL,
    spent numeric DEFAULT 0 NOT NULL,
    target_impressions integer DEFAULT 0 NOT NULL,
    target_clicks integer DEFAULT 0 NOT NULL,
    start_date date,
    end_date date,
    target_roles text[] DEFAULT ARRAY['patient'::text, 'resident'::text, 'doctor'::text],
    target_language text,
    placement_ids uuid[] DEFAULT '{}'::uuid[],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ad_campaigns_public; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.ad_campaigns_public WITH (security_invoker='true') AS
 SELECT id,
    name,
    status,
    start_date,
    end_date,
    target_roles,
    target_language,
    placement_ids,
    created_at
   FROM public.ad_campaigns
  WHERE (status = 'active'::text);


--
-- Name: ad_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ad_config (
    id text DEFAULT 'default'::text NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    cpm_rate numeric DEFAULT 50 NOT NULL,
    cpc_rate numeric DEFAULT 5 NOT NULL,
    min_budget numeric DEFAULT 500 NOT NULL,
    max_file_size_kb integer DEFAULT 2048 NOT NULL,
    allowed_formats text[] DEFAULT ARRAY['image'::text, 'gif'::text, 'video'::text] NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ad_creatives; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ad_creatives (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    placement_id uuid NOT NULL,
    media_url text NOT NULL,
    media_type text DEFAULT 'image'::text NOT NULL,
    click_url text DEFAULT ''::text NOT NULL,
    alt_text text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ad_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ad_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    creative_id uuid NOT NULL,
    campaign_id uuid NOT NULL,
    event_type text NOT NULL,
    user_id uuid,
    user_role text,
    user_language text,
    ip_hash text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ad_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ad_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    amount numeric NOT NULL,
    payment_method text DEFAULT 'stripe'::text NOT NULL,
    stripe_session_id text,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ad_placements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ad_placements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    display_name text NOT NULL,
    description text,
    width integer DEFAULT 728 NOT NULL,
    height integer DEFAULT 90 NOT NULL,
    format text DEFAULT 'banner'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: arco_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.arco_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    full_name text NOT NULL,
    email text NOT NULL,
    request_type text NOT NULL,
    description text NOT NULL,
    identification_url text,
    status text DEFAULT 'pending'::text NOT NULL,
    admin_notes text,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT arco_requests_description_check CHECK (((length(description) >= 10) AND (length(description) <= 5000))),
    CONSTRAINT arco_requests_email_check CHECK (((length(email) >= 5) AND (length(email) <= 255))),
    CONSTRAINT arco_requests_full_name_check CHECK (((length(full_name) >= 2) AND (length(full_name) <= 200))),
    CONSTRAINT arco_requests_request_type_check CHECK ((request_type = ANY (ARRAY['access'::text, 'rectification'::text, 'cancellation'::text, 'opposition'::text]))),
    CONSTRAINT arco_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_review'::text, 'resolved'::text, 'rejected'::text])))
);


--
-- Name: cedula_verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cedula_verifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    cedula_number text NOT NULL,
    nombre text,
    paterno text,
    materno text,
    titulo text,
    institucion text,
    anio_registro integer,
    verified_at timestamp with time zone,
    is_verified boolean DEFAULT false,
    is_claimed boolean DEFAULT false,
    claimed_by uuid,
    claimed_at timestamp with time zone,
    raw_response jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    content text NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reply_to_id uuid
);


--
-- Name: chat_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    participant1_id uuid NOT NULL,
    participant1_type public.chat_participant_type NOT NULL,
    participant2_id uuid NOT NULL,
    participant2_type public.chat_participant_type NOT NULL,
    last_message text,
    last_message_at timestamp with time zone,
    unread_count_1 integer DEFAULT 0 NOT NULL,
    unread_count_2 integer DEFAULT 0 NOT NULL,
    status public.chat_status DEFAULT 'active'::public.chat_status NOT NULL,
    is_double_check boolean DEFAULT false NOT NULL,
    original_consultation_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    priority_score integer DEFAULT 0,
    CONSTRAINT no_patient_resident_chat CHECK ((NOT (((participant1_type = 'patient'::public.chat_participant_type) AND (participant2_type = 'resident'::public.chat_participant_type)) OR ((participant1_type = 'resident'::public.chat_participant_type) AND (participant2_type = 'patient'::public.chat_participant_type)))))
);


--
-- Name: child_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.child_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    parent_id uuid NOT NULL,
    name text NOT NULL,
    date_of_birth date NOT NULL,
    sex text,
    blood_type text,
    height_cm numeric,
    weight_kg numeric,
    allergies text,
    chronic_conditions text,
    current_medications text,
    vaccines jsonb DEFAULT '{}'::jsonb NOT NULL,
    extended_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    notes text,
    invited_at timestamp with time zone,
    inherited_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: clinical_case_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinical_case_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id uuid NOT NULL,
    author_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: clinical_cases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinical_cases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    author_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    specialty text NOT NULL,
    category text,
    patient_age integer,
    patient_sex text,
    file_url text,
    thumbnail_url text,
    comments_count integer DEFAULT 0 NOT NULL,
    views_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: clinical_session_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinical_session_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    status public.clinical_session_status DEFAULT 'pending'::public.clinical_session_status NOT NULL,
    responded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    invitee_name text,
    invitee_email text
);


--
-- Name: clinical_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinical_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizer_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    case_summary text,
    specialty text NOT NULL,
    status public.clinical_session_status DEFAULT 'pending'::public.clinical_session_status NOT NULL,
    scheduled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    daily_room_name text,
    daily_room_url text,
    meeting_notes text,
    meeting_summary text,
    max_participants integer DEFAULT 10,
    meeting_type text DEFAULT 'case_discussion'::text NOT NULL
);


--
-- Name: consultation_ratings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consultation_ratings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consultation_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    rating integer NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT consultation_ratings_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: consultations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consultations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    chat_session_id uuid,
    status text DEFAULT 'active'::text NOT NULL,
    diagnosis text,
    notes text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    video_room_name text,
    video_room_url text,
    doctor_summary text,
    doctor_recommendations text,
    completed_at timestamp with time zone
);


--
-- Name: disclaimer_acceptances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.disclaimer_acceptances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    disclaimer_key text NOT NULL,
    disclaimer_version text DEFAULT 'v1'::text NOT NULL,
    accepted_at timestamp with time zone DEFAULT now() NOT NULL,
    context jsonb DEFAULT '{}'::jsonb
);


--
-- Name: doctor_availability; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctor_availability (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    doctor_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    scheduled_at timestamp with time zone NOT NULL,
    duration_minutes integer DEFAULT 60 NOT NULL,
    type text DEFAULT 'live'::text NOT NULL,
    status public.availability_status DEFAULT 'scheduled'::public.availability_status NOT NULL,
    notifications_sent boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    reminder_sent boolean DEFAULT false NOT NULL
);


--
-- Name: doctor_bank_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctor_bank_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    doctor_id uuid NOT NULL,
    stripe_account_id text,
    stripe_account_status text DEFAULT 'pending'::text,
    account_holder_name text,
    bank_name text,
    clabe_last4 text,
    is_verified boolean DEFAULT false,
    onboarding_completed boolean DEFAULT false,
    payouts_enabled boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    clabe character varying(18),
    rfc character varying(13),
    bank_branch character varying(100),
    payment_method character varying(20) DEFAULT 'none'::character varying
);


--
-- Name: COLUMN doctor_bank_accounts.clabe; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.doctor_bank_accounts.clabe IS 'Full 18-digit CLABE interbancaria';


--
-- Name: COLUMN doctor_bank_accounts.rfc; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.doctor_bank_accounts.rfc IS 'RFC del doctor (persona física)';


--
-- Name: COLUMN doctor_bank_accounts.bank_branch; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.doctor_bank_accounts.bank_branch IS 'Sucursal bancaria';


--
-- Name: COLUMN doctor_bank_accounts.payment_method; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.doctor_bank_accounts.payment_method IS 'Preferred payment method: stripe, bank, both, none';


--
-- Name: doctor_certifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctor_certifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    doctor_id uuid NOT NULL,
    name text NOT NULL,
    issuing_organization text NOT NULL,
    issue_date date,
    expiry_date date,
    credential_id text,
    document_url text,
    status text DEFAULT 'pending'::text NOT NULL,
    admin_notes text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: doctor_content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctor_content (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    creator_id uuid NOT NULL,
    type public.content_type NOT NULL,
    title text NOT NULL,
    description text,
    file_url text NOT NULL,
    thumbnail_url text,
    is_public boolean DEFAULT true NOT NULL,
    category text,
    price numeric(10,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    audience_type public.content_audience DEFAULT 'all'::public.content_audience NOT NULL,
    is_masterclass boolean DEFAULT false,
    masterclass_sessions jsonb
);


--
-- Name: doctor_education; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctor_education (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    doctor_id uuid NOT NULL,
    institution text NOT NULL,
    degree text NOT NULL,
    field_of_study text,
    start_year integer,
    end_year integer,
    description text,
    document_url text,
    status text DEFAULT 'pending'::text NOT NULL,
    admin_notes text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: doctor_experience; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctor_experience (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    doctor_id uuid NOT NULL,
    title text NOT NULL,
    organization text NOT NULL,
    location text,
    start_date date,
    end_date date,
    is_current boolean DEFAULT false,
    description text,
    status text DEFAULT 'pending'::text NOT NULL,
    admin_notes text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: doctor_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctor_invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    doctor_id uuid NOT NULL,
    invoice_number text NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    amount numeric NOT NULL,
    file_url text NOT NULL,
    file_name text NOT NULL,
    status text DEFAULT 'pending'::text,
    admin_notes text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: doctor_payouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctor_payouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    doctor_id uuid NOT NULL,
    amount numeric NOT NULL,
    stripe_payout_id text,
    stripe_transfer_id text,
    status text DEFAULT 'pending'::text,
    period_start date,
    period_end date,
    invoice_id uuid,
    error_message text,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: doctor_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctor_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    specialty text NOT NULL,
    license text NOT NULL,
    cedula_profesional text,
    numero_consejo text,
    bio text,
    status public.doctor_status DEFAULT 'pending'::public.doctor_status NOT NULL,
    consultation_fee numeric(10,2) DEFAULT 0 NOT NULL,
    rating numeric(3,2) DEFAULT 0 NOT NULL,
    total_consultations integer DEFAULT 0 NOT NULL,
    followers_count integer DEFAULT 0 NOT NULL,
    available_for_double_check boolean DEFAULT false NOT NULL,
    available_for_clinical_sessions boolean DEFAULT false NOT NULL,
    location text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cedula_verification_id uuid,
    stripe_account_id text,
    payouts_enabled boolean DEFAULT false,
    total_earnings numeric DEFAULT 0,
    pending_earnings numeric DEFAULT 0,
    office_hours_start time without time zone DEFAULT '08:00:00'::time without time zone,
    office_hours_end time without time zone DEFAULT '20:00:00'::time without time zone,
    office_days text[] DEFAULT ARRAY['monday'::text, 'tuesday'::text, 'wednesday'::text, 'thursday'::text, 'friday'::text],
    can_publish_news boolean DEFAULT false NOT NULL,
    badge_override text,
    signature_url text,
    rank_override uuid,
    cofepris_permit text,
    cedula_status public.verification_status DEFAULT 'pending'::public.verification_status,
    cedula_rejection_reason text,
    cofepris_status public.verification_status DEFAULT 'pending'::public.verification_status,
    cofepris_rejection_reason text
);


--
-- Name: doctor_profiles_public; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.doctor_profiles_public WITH (security_invoker='true') AS
 SELECT id,
    user_id,
    specialty,
    bio,
    rating,
    followers_count,
    consultation_fee,
    total_consultations,
    location,
    available_for_double_check,
    available_for_clinical_sessions,
    badge_override,
    rank_override,
    office_hours_start,
    office_hours_end,
    office_days,
    signature_url,
    cedula_profesional,
    cofepris_permit,
    cedula_status,
    cedula_rejection_reason,
    cofepris_status,
    cofepris_rejection_reason,
    status,
    created_at,
    updated_at
   FROM public.doctor_profiles dp
  WHERE (status = 'approved'::public.doctor_status);


--
-- Name: doctor_ranks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctor_ranks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    display_name text NOT NULL,
    icon text DEFAULT 'shield'::text NOT NULL,
    color text DEFAULT 'info'::text NOT NULL,
    min_consultations integer DEFAULT 0 NOT NULL,
    min_earnings numeric DEFAULT 0 NOT NULL,
    min_months_active integer DEFAULT 0 NOT NULL,
    min_rating numeric DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: doctor_resident_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctor_resident_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    doctor_id uuid NOT NULL,
    resident_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    responded_at timestamp with time zone
);


--
-- Name: document_signatures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_signatures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    document_type text NOT NULL,
    document_version text DEFAULT '1.0'::text NOT NULL,
    signer_name text NOT NULL,
    ip_address text,
    signed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: email_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    doctor_id uuid NOT NULL,
    recipient_email text NOT NULL,
    recipient_name text,
    email_type text NOT NULL,
    subject text NOT NULL,
    content_id uuid,
    content_title text,
    status text DEFAULT 'sent'::text NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: entitlements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entitlements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: exchange_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exchange_rates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    base_currency text DEFAULT 'MXN'::text NOT NULL,
    target_currency text NOT NULL,
    rate numeric NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: expediente_otp; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expediente_otp (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    otp_code text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: featured_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.featured_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    featured_id uuid NOT NULL,
    event_type text NOT NULL,
    user_id uuid,
    user_role text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT featured_events_event_type_check CHECK ((event_type = ANY (ARRAY['impression'::text, 'click'::text])))
);


--
-- Name: featured_listings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.featured_listings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    listing_type text NOT NULL,
    listing_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    priority integer DEFAULT 1 NOT NULL,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    budget numeric DEFAULT 0 NOT NULL,
    spent numeric DEFAULT 0 NOT NULL,
    cpc_rate numeric DEFAULT 5 NOT NULL,
    cpm_rate numeric DEFAULT 50 NOT NULL,
    label_es text DEFAULT 'Destacado'::text,
    label_en text DEFAULT 'Featured'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT featured_listings_listing_type_check CHECK ((listing_type = ANY (ARRAY['hospital'::text, 'product'::text])))
);


--
-- Name: followers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.followers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    follower_id uuid NOT NULL,
    followed_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fund_holds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fund_holds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    doctor_id uuid NOT NULL,
    amount numeric NOT NULL,
    reason text NOT NULL,
    consultation_id uuid,
    status text DEFAULT 'held'::text NOT NULL,
    held_at timestamp with time zone DEFAULT now() NOT NULL,
    release_at timestamp with time zone,
    released_at timestamp with time zone,
    released_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hospital_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hospital_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hospital_id uuid NOT NULL,
    user_id uuid NOT NULL,
    rating integer NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT hospital_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: hospitals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hospitals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    address text NOT NULL,
    phone text,
    website text,
    type text DEFAULT 'public'::text NOT NULL,
    level text DEFAULT '3er nivel'::text,
    specialties jsonb DEFAULT '[]'::jsonb,
    hours text,
    zone text,
    image_url text,
    lat numeric,
    lng numeric,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_featured boolean DEFAULT false NOT NULL
);


--
-- Name: identity_verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.identity_verifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    provider text DEFAULT 'manual'::text NOT NULL,
    external_id text,
    status public.identity_verification_status DEFAULT 'pending'::public.identity_verification_status NOT NULL,
    verified_at timestamp with time zone,
    expires_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: live_chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.live_chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    live_id uuid NOT NULL,
    user_id uuid NOT NULL,
    user_name text NOT NULL,
    content text NOT NULL,
    elapsed_seconds integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_paid boolean DEFAULT false NOT NULL,
    highlight_until timestamp with time zone
);


--
-- Name: live_consultation_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.live_consultation_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    live_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    message text NOT NULL,
    payment_method text DEFAULT 'wallet'::text NOT NULL,
    amount numeric DEFAULT 0 NOT NULL,
    chat_session_id uuid,
    consultation_id uuid,
    status text DEFAULT 'completed'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: live_doctor_chat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.live_doctor_chat (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    live_id uuid NOT NULL,
    user_id uuid NOT NULL,
    user_name text NOT NULL,
    user_specialty text,
    content text NOT NULL,
    reply_to_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: live_likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.live_likes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    live_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lives; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lives (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    doctor_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    specialty text NOT NULL,
    status public.live_status DEFAULT 'live'::public.live_status NOT NULL,
    viewer_count integer DEFAULT 0 NOT NULL,
    likes_count integer DEFAULT 0 NOT NULL,
    thumbnail_url text,
    recording_price numeric(10,2),
    tags text[] DEFAULT '{}'::text[],
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    daily_room_name text,
    peak_viewers integer DEFAULT 0 NOT NULL,
    chat_enabled boolean DEFAULT true NOT NULL,
    max_questions integer,
    max_paid_chats integer,
    questions_count integer DEFAULT 0 NOT NULL,
    paid_chats_count integer DEFAULT 0 NOT NULL,
    location text,
    chat_mode text DEFAULT 'free'::text NOT NULL,
    chat_price numeric DEFAULT 0 NOT NULL,
    chat_highlight_seconds integer DEFAULT 120
);


--
-- Name: marketplace_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketplace_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name_es text NOT NULL,
    name_en text NOT NULL,
    icon text DEFAULT 'Package'::text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: marketplace_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketplace_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    buyer_id uuid NOT NULL,
    product_id uuid,
    vendor_id uuid,
    quantity integer DEFAULT 1 NOT NULL,
    total_amount numeric DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    shipping_address jsonb,
    stripe_session_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    shipping_name text,
    shipping_phone text,
    shipping_city text,
    shipping_state text,
    shipping_zip text,
    shipping_notes text,
    tracking_number text,
    estimated_delivery date,
    delivery_fee numeric DEFAULT 0,
    paid_at timestamp with time zone,
    shipped_at timestamp with time zone,
    delivered_at timestamp with time zone
);


--
-- Name: marketplace_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketplace_products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vendor_id uuid NOT NULL,
    category_id uuid,
    name text NOT NULL,
    description text,
    category text,
    price numeric DEFAULT 0 NOT NULL,
    currency text DEFAULT 'MXN'::text NOT NULL,
    image_url text,
    images jsonb DEFAULT '[]'::jsonb,
    stock integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_featured boolean DEFAULT false NOT NULL
);


--
-- Name: marketplace_vendors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketplace_vendors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    name text NOT NULL,
    description text,
    logo_url text,
    website text,
    phone text,
    location text,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: medical_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.medical_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    file_type public.vault_file_type NOT NULL,
    file_url text NOT NULL,
    file_size integer DEFAULT 0 NOT NULL,
    category text NOT NULL,
    date_of_study timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    habit_alcohol_amount text,
    habit_smoking_amount text,
    habit_vaping_amount text,
    habit_hookah_amount text,
    habit_drugs_amount text,
    habit_exercise_amount text
);


--
-- Name: medical_news; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.medical_news (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    summary text,
    image_url text,
    source_url text,
    category text DEFAULT 'general'::text NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    published_at timestamp with time zone,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    slug text,
    last_edited_at timestamp with time zone,
    last_edited_by uuid,
    author_bio text,
    author_social jsonb DEFAULT '{}'::jsonb,
    view_count integer DEFAULT 0 NOT NULL
);


--
-- Name: news_comment_likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.news_comment_likes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    comment_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: news_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.news_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    news_id uuid NOT NULL,
    user_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    parent_comment_id uuid
);


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    email_notifications boolean DEFAULT true NOT NULL,
    push_notifications boolean DEFAULT true NOT NULL,
    in_app_notifications boolean DEFAULT true NOT NULL,
    notify_doctor_live boolean DEFAULT true NOT NULL,
    notify_new_content boolean DEFAULT true NOT NULL,
    notify_chat_messages boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type public.notification_type NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: onboarding_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.onboarding_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    step integer DEFAULT 1 NOT NULL,
    selected_role text,
    specialty text,
    license text,
    institution text,
    year integer DEFAULT 1,
    avatar_url text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    phone text
);


--
-- Name: patient_clinical_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_clinical_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    blood_type text,
    allergies text,
    chronic_conditions text,
    current_medications text,
    previous_surgeries text,
    family_history text,
    emergency_contact_name text,
    emergency_contact_phone text,
    height_cm numeric,
    weight_kg numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sex text,
    date_of_birth date,
    family_diabetes boolean DEFAULT false,
    family_diabetes_detail text,
    family_hypertension boolean DEFAULT false,
    family_hypertension_detail text,
    family_cancer boolean DEFAULT false,
    family_cancer_detail text,
    family_heart_disease boolean DEFAULT false,
    family_heart_disease_detail text,
    family_mental_illness boolean DEFAULT false,
    family_mental_illness_detail text,
    family_other text,
    habit_alcohol text DEFAULT 'never'::text,
    habit_smoking text DEFAULT 'never'::text,
    habit_vaping text DEFAULT 'never'::text,
    habit_hookah text DEFAULT 'never'::text,
    habit_drugs text DEFAULT 'never'::text,
    habit_exercise text DEFAULT 'never'::text,
    gyn_last_period date,
    gyn_pregnancies integer DEFAULT 0,
    gyn_births integer DEFAULT 0,
    gyn_cesareans integer DEFAULT 0,
    gyn_abortions integer DEFAULT 0,
    gyn_contraceptive text,
    gyn_pap_result text,
    vaccines jsonb DEFAULT '{}'::jsonb,
    notes text,
    extended_data jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: COLUMN patient_clinical_history.extended_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.patient_clinical_history.extended_data IS 'Extended clinical fields stored as flexible JSON: chronic_other (cual/diagnostico/tratamiento/fecha), surgeries (array of {description,date,complications}), complications (text), family_matrix ({disease: [relations]}), habits_detail ({alcoholism:{drink,frequency,amount}, smoking:{cigarette:{frequency,amount}, vape:{...}, hookah:{...}}, drugs:{frequency,amount}, physical_activity:{type,frequency}})';


--
-- Name: patient_vaccinations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_vaccinations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    child_id uuid,
    vaccine_key text NOT NULL,
    dose_number integer DEFAULT 1 NOT NULL,
    applied boolean DEFAULT true NOT NULL,
    application_date date,
    lot text,
    notes text,
    last_reminded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payout_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payout_settings (
    id text DEFAULT 'default'::text NOT NULL,
    payout_frequency text DEFAULT 'weekly'::text,
    payout_day integer DEFAULT 1,
    commission_percentage numeric DEFAULT 20,
    minimum_payout_amount numeric DEFAULT 100,
    auto_payout_enabled boolean DEFAULT true,
    require_invoice boolean DEFAULT true,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    commission_consultation numeric,
    commission_recording numeric,
    commission_live numeric,
    commission_chat numeric,
    commission_content numeric
);


--
-- Name: payout_settings_public; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.payout_settings_public WITH (security_invoker='true') AS
 SELECT commission_percentage,
    payout_frequency
   FROM public.payout_settings
  WHERE (id = 'default'::text);


--
-- Name: phone_verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.phone_verifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    phone text NOT NULL,
    otp_code text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: prescriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prescriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    doctor_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    consultation_id uuid,
    patient_name text NOT NULL,
    patient_age text,
    diagnosis text,
    medications jsonb DEFAULT '[]'::jsonb NOT NULL,
    instructions text,
    notes text,
    doctor_name text NOT NULL,
    doctor_specialty text NOT NULL,
    doctor_license text NOT NULL,
    doctor_cedula text,
    signed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    file_url text
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    name text NOT NULL,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    preferred_language public.supported_language DEFAULT 'es'::public.supported_language NOT NULL,
    is_identity_verified boolean DEFAULT false NOT NULL,
    onboarding_completed boolean DEFAULT false NOT NULL,
    storage_used_bytes bigint DEFAULT 0 NOT NULL,
    storage_limit_bytes bigint DEFAULT 1073741824 NOT NULL,
    username text,
    country_code text DEFAULT 'MX'::text,
    currency_code text DEFAULT 'MXN'::text,
    country_flag text DEFAULT '🇲🇽'::text,
    phone text,
    vaccine_reminders_enabled boolean DEFAULT true NOT NULL
);


--
-- Name: profiles_public; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.profiles_public WITH (security_invoker='true') AS
 SELECT id,
    name,
    avatar_url,
    is_identity_verified,
    created_at,
    updated_at
   FROM public.profiles;


--
-- Name: purchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    recording_id uuid,
    amount numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    content_id uuid
);


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: recordings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recordings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    live_id uuid,
    doctor_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    specialty text NOT NULL,
    duration integer DEFAULT 0 NOT NULL,
    price numeric(10,2) DEFAULT 0 NOT NULL,
    thumbnail_url text,
    video_url text,
    tags text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    peak_viewers integer DEFAULT 0 NOT NULL
);


--
-- Name: referral_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referral_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    code text NOT NULL,
    uses_count integer DEFAULT 0 NOT NULL,
    max_uses integer,
    discount_percentage numeric DEFAULT 10 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: referral_redemptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referral_redemptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    referral_code_id uuid NOT NULL,
    referred_user_id uuid NOT NULL,
    referrer_user_id uuid NOT NULL,
    discount_applied numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: refund_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refund_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    transaction_id uuid NOT NULL,
    amount numeric NOT NULL,
    reason text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    admin_notes text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    refund_method text DEFAULT 'wallet'::text,
    stripe_refund_id text,
    bank_transfer_reference text,
    bank_transfer_date timestamp with time zone,
    estimated_completion_date timestamp with time zone,
    user_has_stripe boolean DEFAULT false,
    user_has_bank_account boolean DEFAULT false
);


--
-- Name: reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reporter_id uuid NOT NULL,
    content_type text NOT NULL,
    content_id uuid,
    reason text NOT NULL,
    description text,
    status text DEFAULT 'pending'::text NOT NULL,
    admin_notes text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    subject text,
    contact_email text,
    attachment_urls text[],
    CONSTRAINT reports_content_type_check CHECK ((content_type = ANY (ARRAY['live'::text, 'recording'::text, 'doctor'::text, 'chat_message'::text, 'platform_report'::text]))),
    CONSTRAINT reports_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'reviewed'::text, 'resolved'::text, 'dismissed'::text])))
);


--
-- Name: resident_group_activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resident_group_activity (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    user_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: resident_group_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resident_group_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    user_id uuid NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: resident_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resident_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    specialty text,
    image_url text,
    member_count integer DEFAULT 0 NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: resident_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resident_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    institution text NOT NULL,
    specialty text NOT NULL,
    year integer DEFAULT 1 NOT NULL,
    titulo_medicina text,
    cedula_profesional text,
    status public.doctor_status DEFAULT 'pending'::public.doctor_status NOT NULL,
    followers_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: resident_profiles_public; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.resident_profiles_public WITH (security_invoker='true') AS
 SELECT id,
    user_id,
    institution,
    specialty,
    year,
    status,
    followers_count,
    created_at,
    updated_at
   FROM public.resident_profiles;


--
-- Name: site_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_settings (
    id text NOT NULL,
    value jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid
);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subscriber_id uuid NOT NULL,
    creator_id uuid NOT NULL,
    price_paid numeric(10,2) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    tier public.subscription_tier DEFAULT 'free'::public.subscription_tier NOT NULL,
    notify_on_live boolean DEFAULT true NOT NULL,
    notify_on_content boolean DEFAULT true NOT NULL,
    notify_on_availability boolean DEFAULT true NOT NULL,
    early_access_minutes integer DEFAULT 0
);


--
-- Name: user_bank_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_bank_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    bank_name text NOT NULL,
    clabe character varying(18) NOT NULL,
    clabe_last4 character varying(4) NOT NULL,
    account_holder_name text NOT NULL,
    rfc character varying(13),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_blocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_blocks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    blocker_id uuid NOT NULL,
    blocked_id uuid NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_blocks_no_self CHECK ((blocker_id <> blocked_id))
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role DEFAULT 'patient'::public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vault_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vault_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    file_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    consultation_id uuid
);


--
-- Name: vault_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vault_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    file_id uuid,
    actor_id uuid,
    patient_id uuid NOT NULL,
    action text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT vault_audit_log_action_check CHECK ((action = ANY (ARRAY['accessed'::text, 'access_denied'::text, 'access_granted'::text, 'access_revoked'::text, 'otp_required'::text, 'otp_failed'::text, 'otp_verified'::text])))
);


--
-- Name: vault_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vault_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    medical_history_id uuid,
    name text NOT NULL,
    file_type public.vault_file_type NOT NULL,
    file_url text NOT NULL,
    file_size integer DEFAULT 0 NOT NULL,
    category text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: wallet_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallet_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type public.transaction_type NOT NULL,
    amount numeric(10,2) NOT NULL,
    description text NOT NULL,
    status public.transaction_status DEFAULT 'initiated'::public.transaction_status NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: wallets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    balance numeric(10,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ad_campaigns ad_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_campaigns
    ADD CONSTRAINT ad_campaigns_pkey PRIMARY KEY (id);


--
-- Name: ad_config ad_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_config
    ADD CONSTRAINT ad_config_pkey PRIMARY KEY (id);


--
-- Name: ad_creatives ad_creatives_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_creatives
    ADD CONSTRAINT ad_creatives_pkey PRIMARY KEY (id);


--
-- Name: ad_events ad_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_events
    ADD CONSTRAINT ad_events_pkey PRIMARY KEY (id);


--
-- Name: ad_payments ad_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_payments
    ADD CONSTRAINT ad_payments_pkey PRIMARY KEY (id);


--
-- Name: ad_placements ad_placements_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_placements
    ADD CONSTRAINT ad_placements_name_key UNIQUE (name);


--
-- Name: ad_placements ad_placements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_placements
    ADD CONSTRAINT ad_placements_pkey PRIMARY KEY (id);


--
-- Name: arco_requests arco_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.arco_requests
    ADD CONSTRAINT arco_requests_pkey PRIMARY KEY (id);


--
-- Name: cedula_verifications cedula_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cedula_verifications
    ADD CONSTRAINT cedula_verifications_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: chat_sessions chat_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sessions
    ADD CONSTRAINT chat_sessions_pkey PRIMARY KEY (id);


--
-- Name: child_profiles child_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.child_profiles
    ADD CONSTRAINT child_profiles_pkey PRIMARY KEY (id);


--
-- Name: clinical_case_comments clinical_case_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_case_comments
    ADD CONSTRAINT clinical_case_comments_pkey PRIMARY KEY (id);


--
-- Name: clinical_cases clinical_cases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_cases
    ADD CONSTRAINT clinical_cases_pkey PRIMARY KEY (id);


--
-- Name: clinical_session_invitations clinical_session_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_session_invitations
    ADD CONSTRAINT clinical_session_invitations_pkey PRIMARY KEY (id);


--
-- Name: clinical_session_invitations clinical_session_invitations_session_id_doctor_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_session_invitations
    ADD CONSTRAINT clinical_session_invitations_session_id_doctor_id_key UNIQUE (session_id, doctor_id);


--
-- Name: clinical_sessions clinical_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_sessions
    ADD CONSTRAINT clinical_sessions_pkey PRIMARY KEY (id);


--
-- Name: consultation_ratings consultation_ratings_consultation_id_patient_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultation_ratings
    ADD CONSTRAINT consultation_ratings_consultation_id_patient_id_key UNIQUE (consultation_id, patient_id);


--
-- Name: consultation_ratings consultation_ratings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultation_ratings
    ADD CONSTRAINT consultation_ratings_pkey PRIMARY KEY (id);


--
-- Name: consultations consultations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT consultations_pkey PRIMARY KEY (id);


--
-- Name: disclaimer_acceptances disclaimer_acceptances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disclaimer_acceptances
    ADD CONSTRAINT disclaimer_acceptances_pkey PRIMARY KEY (id);


--
-- Name: disclaimer_acceptances disclaimer_acceptances_user_id_disclaimer_key_disclaimer_ve_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disclaimer_acceptances
    ADD CONSTRAINT disclaimer_acceptances_user_id_disclaimer_key_disclaimer_ve_key UNIQUE (user_id, disclaimer_key, disclaimer_version);


--
-- Name: doctor_availability doctor_availability_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_availability
    ADD CONSTRAINT doctor_availability_pkey PRIMARY KEY (id);


--
-- Name: doctor_bank_accounts doctor_bank_accounts_doctor_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_bank_accounts
    ADD CONSTRAINT doctor_bank_accounts_doctor_id_key UNIQUE (doctor_id);


--
-- Name: doctor_bank_accounts doctor_bank_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_bank_accounts
    ADD CONSTRAINT doctor_bank_accounts_pkey PRIMARY KEY (id);


--
-- Name: doctor_certifications doctor_certifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_certifications
    ADD CONSTRAINT doctor_certifications_pkey PRIMARY KEY (id);


--
-- Name: doctor_content doctor_content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_content
    ADD CONSTRAINT doctor_content_pkey PRIMARY KEY (id);


--
-- Name: doctor_education doctor_education_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_education
    ADD CONSTRAINT doctor_education_pkey PRIMARY KEY (id);


--
-- Name: doctor_experience doctor_experience_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_experience
    ADD CONSTRAINT doctor_experience_pkey PRIMARY KEY (id);


--
-- Name: doctor_invoices doctor_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_invoices
    ADD CONSTRAINT doctor_invoices_pkey PRIMARY KEY (id);


--
-- Name: doctor_payouts doctor_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_payouts
    ADD CONSTRAINT doctor_payouts_pkey PRIMARY KEY (id);


--
-- Name: doctor_profiles doctor_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_profiles
    ADD CONSTRAINT doctor_profiles_pkey PRIMARY KEY (id);


--
-- Name: doctor_profiles doctor_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_profiles
    ADD CONSTRAINT doctor_profiles_user_id_key UNIQUE (user_id);


--
-- Name: doctor_ranks doctor_ranks_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_ranks
    ADD CONSTRAINT doctor_ranks_name_key UNIQUE (name);


--
-- Name: doctor_ranks doctor_ranks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_ranks
    ADD CONSTRAINT doctor_ranks_pkey PRIMARY KEY (id);


--
-- Name: doctor_resident_connections doctor_resident_connections_doctor_id_resident_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_resident_connections
    ADD CONSTRAINT doctor_resident_connections_doctor_id_resident_id_key UNIQUE (doctor_id, resident_id);


--
-- Name: doctor_resident_connections doctor_resident_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_resident_connections
    ADD CONSTRAINT doctor_resident_connections_pkey PRIMARY KEY (id);


--
-- Name: document_signatures document_signatures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_signatures
    ADD CONSTRAINT document_signatures_pkey PRIMARY KEY (id);


--
-- Name: document_signatures document_signatures_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_signatures
    ADD CONSTRAINT document_signatures_unique UNIQUE (user_id, document_type, document_version);


--
-- Name: email_history email_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_history
    ADD CONSTRAINT email_history_pkey PRIMARY KEY (id);


--
-- Name: entitlements entitlements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entitlements
    ADD CONSTRAINT entitlements_pkey PRIMARY KEY (id);


--
-- Name: entitlements entitlements_user_id_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entitlements
    ADD CONSTRAINT entitlements_user_id_type_key UNIQUE (user_id, type);


--
-- Name: exchange_rates exchange_rates_base_currency_target_currency_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_base_currency_target_currency_key UNIQUE (base_currency, target_currency);


--
-- Name: exchange_rates exchange_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_pkey PRIMARY KEY (id);


--
-- Name: expediente_otp expediente_otp_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expediente_otp
    ADD CONSTRAINT expediente_otp_pkey PRIMARY KEY (id);


--
-- Name: featured_events featured_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.featured_events
    ADD CONSTRAINT featured_events_pkey PRIMARY KEY (id);


--
-- Name: featured_listings featured_listings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.featured_listings
    ADD CONSTRAINT featured_listings_pkey PRIMARY KEY (id);


--
-- Name: followers followers_follower_id_followed_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.followers
    ADD CONSTRAINT followers_follower_id_followed_id_key UNIQUE (follower_id, followed_id);


--
-- Name: followers followers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.followers
    ADD CONSTRAINT followers_pkey PRIMARY KEY (id);


--
-- Name: fund_holds fund_holds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fund_holds
    ADD CONSTRAINT fund_holds_pkey PRIMARY KEY (id);


--
-- Name: hospital_reviews hospital_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospital_reviews
    ADD CONSTRAINT hospital_reviews_pkey PRIMARY KEY (id);


--
-- Name: hospitals hospitals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospitals
    ADD CONSTRAINT hospitals_pkey PRIMARY KEY (id);


--
-- Name: identity_verifications identity_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.identity_verifications
    ADD CONSTRAINT identity_verifications_pkey PRIMARY KEY (id);


--
-- Name: live_chat_messages live_chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_chat_messages
    ADD CONSTRAINT live_chat_messages_pkey PRIMARY KEY (id);


--
-- Name: live_consultation_requests live_consultation_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_consultation_requests
    ADD CONSTRAINT live_consultation_requests_pkey PRIMARY KEY (id);


--
-- Name: live_doctor_chat live_doctor_chat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_doctor_chat
    ADD CONSTRAINT live_doctor_chat_pkey PRIMARY KEY (id);


--
-- Name: live_likes live_likes_live_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_likes
    ADD CONSTRAINT live_likes_live_id_user_id_key UNIQUE (live_id, user_id);


--
-- Name: live_likes live_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_likes
    ADD CONSTRAINT live_likes_pkey PRIMARY KEY (id);


--
-- Name: lives lives_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lives
    ADD CONSTRAINT lives_pkey PRIMARY KEY (id);


--
-- Name: marketplace_categories marketplace_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_categories
    ADD CONSTRAINT marketplace_categories_pkey PRIMARY KEY (id);


--
-- Name: marketplace_orders marketplace_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_orders
    ADD CONSTRAINT marketplace_orders_pkey PRIMARY KEY (id);


--
-- Name: marketplace_products marketplace_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_products
    ADD CONSTRAINT marketplace_products_pkey PRIMARY KEY (id);


--
-- Name: marketplace_vendors marketplace_vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_vendors
    ADD CONSTRAINT marketplace_vendors_pkey PRIMARY KEY (id);


--
-- Name: medical_history medical_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_history
    ADD CONSTRAINT medical_history_pkey PRIMARY KEY (id);


--
-- Name: medical_news medical_news_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_news
    ADD CONSTRAINT medical_news_pkey PRIMARY KEY (id);


--
-- Name: medical_news medical_news_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_news
    ADD CONSTRAINT medical_news_slug_key UNIQUE (slug);


--
-- Name: news_comment_likes news_comment_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_comment_likes
    ADD CONSTRAINT news_comment_likes_pkey PRIMARY KEY (id);


--
-- Name: news_comment_likes news_comment_likes_user_id_comment_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_comment_likes
    ADD CONSTRAINT news_comment_likes_user_id_comment_id_key UNIQUE (user_id, comment_id);


--
-- Name: news_comments news_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_comments
    ADD CONSTRAINT news_comments_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_key UNIQUE (user_id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: onboarding_progress onboarding_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_progress
    ADD CONSTRAINT onboarding_progress_pkey PRIMARY KEY (id);


--
-- Name: onboarding_progress onboarding_progress_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_progress
    ADD CONSTRAINT onboarding_progress_user_id_key UNIQUE (user_id);


--
-- Name: patient_clinical_history patient_clinical_history_patient_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_clinical_history
    ADD CONSTRAINT patient_clinical_history_patient_id_key UNIQUE (patient_id);


--
-- Name: patient_clinical_history patient_clinical_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_clinical_history
    ADD CONSTRAINT patient_clinical_history_pkey PRIMARY KEY (id);


--
-- Name: patient_vaccinations patient_vaccinations_patient_id_child_id_vaccine_key_dose_n_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_vaccinations
    ADD CONSTRAINT patient_vaccinations_patient_id_child_id_vaccine_key_dose_n_key UNIQUE (patient_id, child_id, vaccine_key, dose_number);


--
-- Name: patient_vaccinations patient_vaccinations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_vaccinations
    ADD CONSTRAINT patient_vaccinations_pkey PRIMARY KEY (id);


--
-- Name: payout_settings payout_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payout_settings
    ADD CONSTRAINT payout_settings_pkey PRIMARY KEY (id);


--
-- Name: phone_verifications phone_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phone_verifications
    ADD CONSTRAINT phone_verifications_pkey PRIMARY KEY (id);


--
-- Name: prescriptions prescriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_username_key UNIQUE (username);


--
-- Name: purchases purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_pkey PRIMARY KEY (id);


--
-- Name: purchases purchases_user_id_recording_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_user_id_recording_id_key UNIQUE (user_id, recording_id);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: push_subscriptions push_subscriptions_user_id_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_endpoint_key UNIQUE (user_id, endpoint);


--
-- Name: recordings recordings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recordings
    ADD CONSTRAINT recordings_pkey PRIMARY KEY (id);


--
-- Name: referral_codes referral_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_codes
    ADD CONSTRAINT referral_codes_code_key UNIQUE (code);


--
-- Name: referral_codes referral_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_codes
    ADD CONSTRAINT referral_codes_pkey PRIMARY KEY (id);


--
-- Name: referral_redemptions referral_redemptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_redemptions
    ADD CONSTRAINT referral_redemptions_pkey PRIMARY KEY (id);


--
-- Name: referral_redemptions referral_redemptions_referred_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_redemptions
    ADD CONSTRAINT referral_redemptions_referred_user_id_key UNIQUE (referred_user_id);


--
-- Name: refund_requests refund_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund_requests
    ADD CONSTRAINT refund_requests_pkey PRIMARY KEY (id);


--
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);


--
-- Name: resident_group_activity resident_group_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resident_group_activity
    ADD CONSTRAINT resident_group_activity_pkey PRIMARY KEY (id);


--
-- Name: resident_group_members resident_group_members_group_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resident_group_members
    ADD CONSTRAINT resident_group_members_group_id_user_id_key UNIQUE (group_id, user_id);


--
-- Name: resident_group_members resident_group_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resident_group_members
    ADD CONSTRAINT resident_group_members_pkey PRIMARY KEY (id);


--
-- Name: resident_groups resident_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resident_groups
    ADD CONSTRAINT resident_groups_pkey PRIMARY KEY (id);


--
-- Name: resident_profiles resident_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resident_profiles
    ADD CONSTRAINT resident_profiles_pkey PRIMARY KEY (id);


--
-- Name: resident_profiles resident_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resident_profiles
    ADD CONSTRAINT resident_profiles_user_id_key UNIQUE (user_id);


--
-- Name: site_settings site_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_settings
    ADD CONSTRAINT site_settings_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_subscriber_id_creator_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_subscriber_id_creator_id_key UNIQUE (subscriber_id, creator_id);


--
-- Name: user_bank_accounts user_bank_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_bank_accounts
    ADD CONSTRAINT user_bank_accounts_pkey PRIMARY KEY (id);


--
-- Name: user_bank_accounts user_bank_accounts_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_bank_accounts
    ADD CONSTRAINT user_bank_accounts_user_id_key UNIQUE (user_id);


--
-- Name: user_blocks user_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_blocks
    ADD CONSTRAINT user_blocks_pkey PRIMARY KEY (id);


--
-- Name: user_blocks user_blocks_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_blocks
    ADD CONSTRAINT user_blocks_unique UNIQUE (blocker_id, blocked_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: vault_access vault_access_file_id_doctor_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vault_access
    ADD CONSTRAINT vault_access_file_id_doctor_id_key UNIQUE (file_id, doctor_id);


--
-- Name: vault_access vault_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vault_access
    ADD CONSTRAINT vault_access_pkey PRIMARY KEY (id);


--
-- Name: vault_audit_log vault_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vault_audit_log
    ADD CONSTRAINT vault_audit_log_pkey PRIMARY KEY (id);


--
-- Name: vault_files vault_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vault_files
    ADD CONSTRAINT vault_files_pkey PRIMARY KEY (id);


--
-- Name: wallet_transactions wallet_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_pkey PRIMARY KEY (id);


--
-- Name: wallets wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_pkey PRIMARY KEY (id);


--
-- Name: wallets wallets_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_user_id_key UNIQUE (user_id);


--
-- Name: idx_ad_events_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_events_campaign ON public.ad_events USING btree (campaign_id, event_type);


--
-- Name: idx_ad_events_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_events_created ON public.ad_events USING btree (created_at);


--
-- Name: idx_ad_events_creative; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_events_creative ON public.ad_events USING btree (creative_id, event_type);


--
-- Name: idx_arco_requests_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_arco_requests_status_created ON public.arco_requests USING btree (status, created_at DESC);


--
-- Name: idx_case_comments_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_comments_case ON public.clinical_case_comments USING btree (case_id, created_at);


--
-- Name: idx_cedula_claimed; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_cedula_claimed ON public.cedula_verifications USING btree (cedula_number) WHERE (is_claimed = true);


--
-- Name: idx_chat_messages_reply_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_reply_to ON public.chat_messages USING btree (reply_to_id) WHERE (reply_to_id IS NOT NULL);


--
-- Name: idx_chat_messages_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_session ON public.chat_messages USING btree (session_id);


--
-- Name: idx_chat_messages_session_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_session_created ON public.chat_messages USING btree (session_id, created_at DESC);


--
-- Name: idx_chat_sessions_participants; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_sessions_participants ON public.chat_sessions USING btree (participant1_id, participant2_id);


--
-- Name: idx_child_profiles_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_child_profiles_parent ON public.child_profiles USING btree (parent_id);


--
-- Name: idx_clinical_cases_author; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinical_cases_author ON public.clinical_cases USING btree (author_id);


--
-- Name: idx_clinical_cases_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinical_cases_created ON public.clinical_cases USING btree (created_at DESC);


--
-- Name: idx_clinical_cases_specialty; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinical_cases_specialty ON public.clinical_cases USING btree (specialty);


--
-- Name: idx_clinical_sessions_organizer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinical_sessions_organizer ON public.clinical_sessions USING btree (organizer_id);


--
-- Name: idx_consultation_ratings_consultation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consultation_ratings_consultation ON public.consultation_ratings USING btree (consultation_id);


--
-- Name: idx_consultation_ratings_doctor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consultation_ratings_doctor ON public.consultation_ratings USING btree (doctor_id);


--
-- Name: idx_consultations_doctor_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consultations_doctor_status ON public.consultations USING btree (doctor_id, status);


--
-- Name: idx_consultations_patient_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consultations_patient_status ON public.consultations USING btree (patient_id, status);


--
-- Name: idx_disclaimer_acceptances_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_disclaimer_acceptances_user ON public.disclaimer_acceptances USING btree (user_id, disclaimer_key);


--
-- Name: idx_doctor_availability_doctor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doctor_availability_doctor ON public.doctor_availability USING btree (doctor_id);


--
-- Name: idx_doctor_availability_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doctor_availability_scheduled ON public.doctor_availability USING btree (scheduled_at);


--
-- Name: idx_doctor_availability_upcoming; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doctor_availability_upcoming ON public.doctor_availability USING btree (scheduled_at, status, reminder_sent) WHERE ((status = ANY (ARRAY['scheduled'::public.availability_status, 'confirmed'::public.availability_status])) AND (reminder_sent = false));


--
-- Name: idx_doctor_profiles_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doctor_profiles_status ON public.doctor_profiles USING btree (status);


--
-- Name: idx_email_history_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_history_created_at ON public.email_history USING btree (created_at DESC);


--
-- Name: idx_email_history_doctor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_history_doctor_id ON public.email_history USING btree (doctor_id);


--
-- Name: idx_featured_events_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_featured_events_created_at ON public.featured_events USING btree (created_at);


--
-- Name: idx_featured_events_featured_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_featured_events_featured_id ON public.featured_events USING btree (featured_id);


--
-- Name: idx_featured_listings_type_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_featured_listings_type_active ON public.featured_listings USING btree (listing_type, is_active);


--
-- Name: idx_followers_followed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_followers_followed ON public.followers USING btree (followed_id);


--
-- Name: idx_live_chat_messages_live_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_chat_messages_live_created ON public.live_chat_messages USING btree (live_id, created_at DESC);


--
-- Name: idx_live_chat_messages_live_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_chat_messages_live_id ON public.live_chat_messages USING btree (live_id, elapsed_seconds);


--
-- Name: idx_live_doctor_chat_live; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_doctor_chat_live ON public.live_doctor_chat USING btree (live_id, created_at DESC);


--
-- Name: idx_lives_doctor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lives_doctor_id ON public.lives USING btree (doctor_id);


--
-- Name: idx_lives_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lives_status ON public.lives USING btree (status);


--
-- Name: idx_medical_history_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_medical_history_patient ON public.medical_history USING btree (patient_id);


--
-- Name: idx_news_comments_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_news_comments_created_at ON public.news_comments USING btree (created_at DESC);


--
-- Name: idx_news_comments_news_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_news_comments_news_id ON public.news_comments USING btree (news_id);


--
-- Name: idx_news_comments_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_news_comments_parent ON public.news_comments USING btree (parent_comment_id);


--
-- Name: idx_notifications_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at DESC);


--
-- Name: idx_notifications_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_unread ON public.notifications USING btree (user_id, is_read) WHERE (is_read = false);


--
-- Name: idx_notifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);


--
-- Name: idx_patient_vaccinations_child; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patient_vaccinations_child ON public.patient_vaccinations USING btree (child_id);


--
-- Name: idx_patient_vaccinations_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patient_vaccinations_patient ON public.patient_vaccinations USING btree (patient_id);


--
-- Name: idx_patient_vaccinations_vaccine; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patient_vaccinations_vaccine ON public.patient_vaccinations USING btree (vaccine_key);


--
-- Name: idx_phone_verifications_user_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_phone_verifications_user_phone ON public.phone_verifications USING btree (user_id, phone, otp_code);


--
-- Name: idx_profiles_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_username ON public.profiles USING btree (username);


--
-- Name: idx_purchases_content_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchases_content_id ON public.purchases USING btree (content_id) WHERE (content_id IS NOT NULL);


--
-- Name: idx_recordings_doctor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recordings_doctor_id ON public.recordings USING btree (doctor_id);


--
-- Name: idx_reports_content; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reports_content ON public.reports USING btree (content_type, content_id);


--
-- Name: idx_reports_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reports_status ON public.reports USING btree (status);


--
-- Name: idx_resident_profiles_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resident_profiles_status ON public.resident_profiles USING btree (status);


--
-- Name: idx_subscriptions_creator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_creator ON public.subscriptions USING btree (creator_id);


--
-- Name: idx_user_roles_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_user_id ON public.user_roles USING btree (user_id);


--
-- Name: idx_vault_access_doctor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vault_access_doctor ON public.vault_access USING btree (doctor_id);


--
-- Name: idx_vault_access_file; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vault_access_file ON public.vault_access USING btree (file_id);


--
-- Name: idx_vault_audit_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vault_audit_actor ON public.vault_audit_log USING btree (actor_id, created_at DESC);


--
-- Name: idx_vault_audit_file; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vault_audit_file ON public.vault_audit_log USING btree (file_id, created_at DESC);


--
-- Name: idx_vault_audit_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vault_audit_patient ON public.vault_audit_log USING btree (patient_id, created_at DESC);


--
-- Name: idx_wallet_transactions_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wallet_transactions_user_created ON public.wallet_transactions USING btree (user_id, created_at DESC);


--
-- Name: followers on_follower_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_follower_change AFTER INSERT OR DELETE ON public.followers FOR EACH ROW EXECUTE FUNCTION public.update_followers_count();


--
-- Name: resident_group_members on_group_member_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_group_member_change AFTER INSERT OR DELETE ON public.resident_group_members FOR EACH ROW EXECUTE FUNCTION public.update_group_member_count();


--
-- Name: subscriptions on_subscription_change_update_followers; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_subscription_change_update_followers AFTER INSERT OR DELETE OR UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_followers_count_on_subscription();


--
-- Name: subscriptions on_subscription_change_update_priority; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_subscription_change_update_priority AFTER INSERT OR UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_chat_priority_on_subscription_change();


--
-- Name: wallet_transactions trg_notify_wallet_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_wallet_status AFTER UPDATE ON public.wallet_transactions FOR EACH ROW EXECUTE FUNCTION public.notify_wallet_status_change();


--
-- Name: clinical_case_comments trg_sync_clinical_case_comments_count; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_clinical_case_comments_count AFTER INSERT OR DELETE ON public.clinical_case_comments FOR EACH ROW EXECUTE FUNCTION public.sync_clinical_case_comments_count();


--
-- Name: subscriptions trg_update_chat_priority_on_subscription; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_chat_priority_on_subscription AFTER INSERT OR UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_chat_priority_on_subscription_change();


--
-- Name: doctor_profiles trg_update_doctor_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_doctor_profiles_updated_at BEFORE UPDATE ON public.doctor_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: consultation_ratings trg_update_doctor_rating; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_doctor_rating AFTER INSERT OR DELETE OR UPDATE ON public.consultation_ratings FOR EACH ROW EXECUTE FUNCTION public.update_doctor_rating();


--
-- Name: followers trg_update_followers_count; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_followers_count AFTER INSERT OR DELETE ON public.followers FOR EACH ROW EXECUTE FUNCTION public.update_followers_count();


--
-- Name: subscriptions trg_update_followers_count_on_subscription; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_followers_count_on_subscription AFTER INSERT OR DELETE OR UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_followers_count_on_subscription();


--
-- Name: resident_group_members trg_update_group_member_count; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_group_member_count AFTER INSERT OR DELETE ON public.resident_group_members FOR EACH ROW EXECUTE FUNCTION public.update_group_member_count();


--
-- Name: live_likes trg_update_live_likes_count; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_live_likes_count AFTER INSERT OR DELETE ON public.live_likes FOR EACH ROW EXECUTE FUNCTION public.update_live_likes_count();


--
-- Name: profiles trg_update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: resident_profiles trg_update_resident_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_resident_profiles_updated_at BEFORE UPDATE ON public.resident_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: site_settings trg_update_site_settings_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_site_settings_timestamp BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.update_site_settings_timestamp();


--
-- Name: consultations trg_update_total_consultations; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_total_consultations AFTER UPDATE ON public.consultations FOR EACH ROW EXECUTE FUNCTION public.update_total_consultations();


--
-- Name: chat_messages trg_validate_chat_message_content; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_chat_message_content BEFORE INSERT ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.validate_chat_message_content();


--
-- Name: arco_requests update_arco_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_arco_requests_updated_at BEFORE UPDATE ON public.arco_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: child_profiles update_child_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_child_profiles_updated_at BEFORE UPDATE ON public.child_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: clinical_cases update_clinical_cases_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_clinical_cases_updated_at BEFORE UPDATE ON public.clinical_cases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: clinical_sessions update_clinical_sessions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_clinical_sessions_updated_at BEFORE UPDATE ON public.clinical_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: doctor_availability update_doctor_availability_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_doctor_availability_updated_at BEFORE UPDATE ON public.doctor_availability FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: doctor_bank_accounts update_doctor_bank_accounts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_doctor_bank_accounts_updated_at BEFORE UPDATE ON public.doctor_bank_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: doctor_certifications update_doctor_certifications_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_doctor_certifications_updated_at BEFORE UPDATE ON public.doctor_certifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: doctor_content update_doctor_content_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_doctor_content_updated_at BEFORE UPDATE ON public.doctor_content FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: doctor_education update_doctor_education_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_doctor_education_updated_at BEFORE UPDATE ON public.doctor_education FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: doctor_experience update_doctor_experience_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_doctor_experience_updated_at BEFORE UPDATE ON public.doctor_experience FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: doctor_invoices update_doctor_invoices_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_doctor_invoices_updated_at BEFORE UPDATE ON public.doctor_invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: doctor_profiles update_doctor_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_doctor_profiles_updated_at BEFORE UPDATE ON public.doctor_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: consultation_ratings update_doctor_rating_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_doctor_rating_trigger AFTER INSERT OR UPDATE ON public.consultation_ratings FOR EACH ROW EXECUTE FUNCTION public.update_doctor_rating();


--
-- Name: featured_listings update_featured_listings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_featured_listings_updated_at BEFORE UPDATE ON public.featured_listings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: identity_verifications update_identity_verifications_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_identity_verifications_updated_at BEFORE UPDATE ON public.identity_verifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: medical_history update_medical_history_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_medical_history_updated_at BEFORE UPDATE ON public.medical_history FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: medical_news update_medical_news_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_medical_news_updated_at BEFORE UPDATE ON public.medical_news FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: news_comments update_news_comments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_news_comments_updated_at BEFORE UPDATE ON public.news_comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: notification_preferences update_notification_preferences_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: onboarding_progress update_onboarding_progress_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_onboarding_progress_updated_at BEFORE UPDATE ON public.onboarding_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: patient_clinical_history update_patient_clinical_history_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_patient_clinical_history_updated_at BEFORE UPDATE ON public.patient_clinical_history FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: patient_vaccinations update_patient_vaccinations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_patient_vaccinations_updated_at BEFORE UPDATE ON public.patient_vaccinations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: prescriptions update_prescriptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_prescriptions_updated_at BEFORE UPDATE ON public.prescriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: push_subscriptions update_push_subscriptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_push_subscriptions_updated_at BEFORE UPDATE ON public.push_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: resident_groups update_resident_groups_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_resident_groups_updated_at BEFORE UPDATE ON public.resident_groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: resident_profiles update_resident_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_resident_profiles_updated_at BEFORE UPDATE ON public.resident_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: site_settings update_site_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_site_settings_updated_at BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.update_site_settings_timestamp();


--
-- Name: wallets update_wallets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: chat_messages validate_chat_message_content_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_chat_message_content_trigger BEFORE INSERT OR UPDATE ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.validate_chat_message_content();


--
-- Name: refund_requests validate_refund_request_status_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_refund_request_status_trigger BEFORE INSERT OR UPDATE ON public.refund_requests FOR EACH ROW EXECUTE FUNCTION public.validate_refund_request_status();


--
-- Name: vault_access vault_access_audit_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER vault_access_audit_del AFTER DELETE ON public.vault_access FOR EACH ROW EXECUTE FUNCTION public.trg_vault_access_audit();


--
-- Name: vault_access vault_access_audit_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER vault_access_audit_ins AFTER INSERT ON public.vault_access FOR EACH ROW EXECUTE FUNCTION public.trg_vault_access_audit();


--
-- Name: wallet_transactions wallet_status_change_notify; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER wallet_status_change_notify AFTER UPDATE OF status ON public.wallet_transactions FOR EACH ROW EXECUTE FUNCTION public.notify_wallet_status_change();


--
-- Name: ad_campaigns ad_campaigns_advertiser_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_campaigns
    ADD CONSTRAINT ad_campaigns_advertiser_id_fkey FOREIGN KEY (advertiser_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ad_creatives ad_creatives_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_creatives
    ADD CONSTRAINT ad_creatives_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.ad_campaigns(id) ON DELETE CASCADE;


--
-- Name: ad_creatives ad_creatives_placement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_creatives
    ADD CONSTRAINT ad_creatives_placement_id_fkey FOREIGN KEY (placement_id) REFERENCES public.ad_placements(id) ON DELETE CASCADE;


--
-- Name: ad_events ad_events_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_events
    ADD CONSTRAINT ad_events_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.ad_campaigns(id) ON DELETE CASCADE;


--
-- Name: ad_events ad_events_creative_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_events
    ADD CONSTRAINT ad_events_creative_id_fkey FOREIGN KEY (creative_id) REFERENCES public.ad_creatives(id) ON DELETE CASCADE;


--
-- Name: ad_payments ad_payments_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_payments
    ADD CONSTRAINT ad_payments_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.ad_campaigns(id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_reply_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES public.chat_messages(id) ON DELETE SET NULL;


--
-- Name: chat_messages chat_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.chat_sessions(id) ON DELETE CASCADE;


--
-- Name: chat_sessions chat_sessions_participant1_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sessions
    ADD CONSTRAINT chat_sessions_participant1_id_fkey FOREIGN KEY (participant1_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: chat_sessions chat_sessions_participant2_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sessions
    ADD CONSTRAINT chat_sessions_participant2_id_fkey FOREIGN KEY (participant2_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: child_profiles child_profiles_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.child_profiles
    ADD CONSTRAINT child_profiles_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: clinical_case_comments clinical_case_comments_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_case_comments
    ADD CONSTRAINT clinical_case_comments_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.clinical_cases(id) ON DELETE CASCADE;


--
-- Name: clinical_session_invitations clinical_session_invitations_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_session_invitations
    ADD CONSTRAINT clinical_session_invitations_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: clinical_session_invitations clinical_session_invitations_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_session_invitations
    ADD CONSTRAINT clinical_session_invitations_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.clinical_sessions(id) ON DELETE CASCADE;


--
-- Name: clinical_sessions clinical_sessions_organizer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_sessions
    ADD CONSTRAINT clinical_sessions_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: consultation_ratings consultation_ratings_consultation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultation_ratings
    ADD CONSTRAINT consultation_ratings_consultation_id_fkey FOREIGN KEY (consultation_id) REFERENCES public.consultations(id) ON DELETE CASCADE;


--
-- Name: consultations consultations_chat_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT consultations_chat_session_id_fkey FOREIGN KEY (chat_session_id) REFERENCES public.chat_sessions(id) ON DELETE SET NULL;


--
-- Name: consultations consultations_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT consultations_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: consultations consultations_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT consultations_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: disclaimer_acceptances disclaimer_acceptances_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disclaimer_acceptances
    ADD CONSTRAINT disclaimer_acceptances_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: doctor_content doctor_content_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_content
    ADD CONSTRAINT doctor_content_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: doctor_payouts doctor_payouts_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_payouts
    ADD CONSTRAINT doctor_payouts_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.doctor_invoices(id);


--
-- Name: doctor_profiles doctor_profiles_cedula_verification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_profiles
    ADD CONSTRAINT doctor_profiles_cedula_verification_id_fkey FOREIGN KEY (cedula_verification_id) REFERENCES public.cedula_verifications(id);


--
-- Name: doctor_profiles doctor_profiles_rank_override_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_profiles
    ADD CONSTRAINT doctor_profiles_rank_override_fkey FOREIGN KEY (rank_override) REFERENCES public.doctor_ranks(id) ON DELETE SET NULL;


--
-- Name: doctor_profiles doctor_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_profiles
    ADD CONSTRAINT doctor_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: entitlements entitlements_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entitlements
    ADD CONSTRAINT entitlements_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: featured_events featured_events_featured_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.featured_events
    ADD CONSTRAINT featured_events_featured_id_fkey FOREIGN KEY (featured_id) REFERENCES public.featured_listings(id) ON DELETE CASCADE;


--
-- Name: followers followers_followed_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.followers
    ADD CONSTRAINT followers_followed_id_fkey FOREIGN KEY (followed_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: followers followers_follower_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.followers
    ADD CONSTRAINT followers_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: hospital_reviews hospital_reviews_hospital_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospital_reviews
    ADD CONSTRAINT hospital_reviews_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES public.hospitals(id) ON DELETE CASCADE;


--
-- Name: hospital_reviews hospital_reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospital_reviews
    ADD CONSTRAINT hospital_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: live_chat_messages live_chat_messages_live_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_chat_messages
    ADD CONSTRAINT live_chat_messages_live_id_fkey FOREIGN KEY (live_id) REFERENCES public.lives(id) ON DELETE CASCADE;


--
-- Name: live_consultation_requests live_consultation_requests_chat_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_consultation_requests
    ADD CONSTRAINT live_consultation_requests_chat_session_id_fkey FOREIGN KEY (chat_session_id) REFERENCES public.chat_sessions(id);


--
-- Name: live_consultation_requests live_consultation_requests_consultation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_consultation_requests
    ADD CONSTRAINT live_consultation_requests_consultation_id_fkey FOREIGN KEY (consultation_id) REFERENCES public.consultations(id);


--
-- Name: live_consultation_requests live_consultation_requests_live_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_consultation_requests
    ADD CONSTRAINT live_consultation_requests_live_id_fkey FOREIGN KEY (live_id) REFERENCES public.lives(id) ON DELETE CASCADE;


--
-- Name: live_doctor_chat live_doctor_chat_live_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_doctor_chat
    ADD CONSTRAINT live_doctor_chat_live_id_fkey FOREIGN KEY (live_id) REFERENCES public.lives(id) ON DELETE CASCADE;


--
-- Name: live_doctor_chat live_doctor_chat_reply_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_doctor_chat
    ADD CONSTRAINT live_doctor_chat_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES public.live_doctor_chat(id) ON DELETE SET NULL;


--
-- Name: live_likes live_likes_live_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_likes
    ADD CONSTRAINT live_likes_live_id_fkey FOREIGN KEY (live_id) REFERENCES public.lives(id) ON DELETE CASCADE;


--
-- Name: live_likes live_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_likes
    ADD CONSTRAINT live_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: lives lives_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lives
    ADD CONSTRAINT lives_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: marketplace_orders marketplace_orders_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_orders
    ADD CONSTRAINT marketplace_orders_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: marketplace_orders marketplace_orders_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_orders
    ADD CONSTRAINT marketplace_orders_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.marketplace_products(id) ON DELETE SET NULL;


--
-- Name: marketplace_orders marketplace_orders_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_orders
    ADD CONSTRAINT marketplace_orders_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.marketplace_vendors(id) ON DELETE SET NULL;


--
-- Name: marketplace_products marketplace_products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_products
    ADD CONSTRAINT marketplace_products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.marketplace_categories(id) ON DELETE SET NULL;


--
-- Name: marketplace_products marketplace_products_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_products
    ADD CONSTRAINT marketplace_products_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.marketplace_vendors(id) ON DELETE CASCADE;


--
-- Name: marketplace_vendors marketplace_vendors_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_vendors
    ADD CONSTRAINT marketplace_vendors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: medical_history medical_history_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_history
    ADD CONSTRAINT medical_history_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: news_comment_likes news_comment_likes_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_comment_likes
    ADD CONSTRAINT news_comment_likes_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.news_comments(id) ON DELETE CASCADE;


--
-- Name: news_comments news_comments_news_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_comments
    ADD CONSTRAINT news_comments_news_id_fkey FOREIGN KEY (news_id) REFERENCES public.medical_news(id) ON DELETE CASCADE;


--
-- Name: news_comments news_comments_parent_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_comments
    ADD CONSTRAINT news_comments_parent_comment_id_fkey FOREIGN KEY (parent_comment_id) REFERENCES public.news_comments(id) ON DELETE CASCADE;


--
-- Name: patient_vaccinations patient_vaccinations_child_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_vaccinations
    ADD CONSTRAINT patient_vaccinations_child_id_fkey FOREIGN KEY (child_id) REFERENCES public.child_profiles(id) ON DELETE CASCADE;


--
-- Name: patient_vaccinations patient_vaccinations_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_vaccinations
    ADD CONSTRAINT patient_vaccinations_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: prescriptions prescriptions_consultation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_consultation_id_fkey FOREIGN KEY (consultation_id) REFERENCES public.consultations(id);


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: purchases purchases_content_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_content_id_fkey FOREIGN KEY (content_id) REFERENCES public.doctor_content(id) ON DELETE SET NULL;


--
-- Name: purchases purchases_recording_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_recording_id_fkey FOREIGN KEY (recording_id) REFERENCES public.recordings(id) ON DELETE SET NULL;


--
-- Name: purchases purchases_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: recordings recordings_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recordings
    ADD CONSTRAINT recordings_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: recordings recordings_live_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recordings
    ADD CONSTRAINT recordings_live_id_fkey FOREIGN KEY (live_id) REFERENCES public.lives(id) ON DELETE SET NULL;


--
-- Name: referral_redemptions referral_redemptions_referral_code_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_redemptions
    ADD CONSTRAINT referral_redemptions_referral_code_id_fkey FOREIGN KEY (referral_code_id) REFERENCES public.referral_codes(id);


--
-- Name: refund_requests refund_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund_requests
    ADD CONSTRAINT refund_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: resident_group_activity resident_group_activity_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resident_group_activity
    ADD CONSTRAINT resident_group_activity_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.resident_groups(id) ON DELETE CASCADE;


--
-- Name: resident_group_activity resident_group_activity_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resident_group_activity
    ADD CONSTRAINT resident_group_activity_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: resident_group_members resident_group_members_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resident_group_members
    ADD CONSTRAINT resident_group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.resident_groups(id) ON DELETE CASCADE;


--
-- Name: resident_group_members resident_group_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resident_group_members
    ADD CONSTRAINT resident_group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: resident_groups resident_groups_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resident_groups
    ADD CONSTRAINT resident_groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: resident_profiles resident_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resident_profiles
    ADD CONSTRAINT resident_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: site_settings site_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_settings
    ADD CONSTRAINT site_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: subscriptions subscriptions_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_subscriber_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_subscriber_id_fkey FOREIGN KEY (subscriber_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_bank_accounts user_bank_accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_bank_accounts
    ADD CONSTRAINT user_bank_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: vault_access vault_access_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vault_access
    ADD CONSTRAINT vault_access_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: vault_access vault_access_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vault_access
    ADD CONSTRAINT vault_access_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.vault_files(id) ON DELETE CASCADE;


--
-- Name: vault_audit_log vault_audit_log_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vault_audit_log
    ADD CONSTRAINT vault_audit_log_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.vault_files(id) ON DELETE SET NULL;


--
-- Name: vault_files vault_files_medical_history_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vault_files
    ADD CONSTRAINT vault_files_medical_history_id_fkey FOREIGN KEY (medical_history_id) REFERENCES public.medical_history(id) ON DELETE SET NULL;


--
-- Name: vault_files vault_files_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vault_files
    ADD CONSTRAINT vault_files_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: wallet_transactions wallet_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: wallets wallets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ad_creatives Active creatives visible to all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Active creatives visible to all" ON public.ad_creatives FOR SELECT USING (((is_active = true) AND (EXISTS ( SELECT 1
   FROM public.ad_campaigns c
  WHERE ((c.id = ad_creatives.campaign_id) AND (c.status = 'active'::text))))));


--
-- Name: vault_audit_log Actors view their vault actions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Actors view their vault actions" ON public.vault_audit_log FOR SELECT TO authenticated USING ((actor_id = auth.uid()));


--
-- Name: resident_groups Admins and creators can manage groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and creators can manage groups" ON public.resident_groups USING (((auth.uid() = created_by) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: ad_campaigns Admins can delete campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete campaigns" ON public.ad_campaigns FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: site_settings Admins can insert site settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert site settings" ON public.site_settings FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: doctor_bank_accounts Admins can manage all bank accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all bank accounts" ON public.doctor_bank_accounts USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: doctor_certifications Admins can manage all certifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all certifications" ON public.doctor_certifications USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: news_comments Admins can manage all comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all comments" ON public.news_comments USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: doctor_education Admins can manage all education; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all education" ON public.doctor_education USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: doctor_experience Admins can manage all experience; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all experience" ON public.doctor_experience USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: fund_holds Admins can manage all holds; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all holds" ON public.fund_holds USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: doctor_invoices Admins can manage all invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all invoices" ON public.doctor_invoices USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: medical_news Admins can manage all news; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all news" ON public.medical_news USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: marketplace_orders Admins can manage all orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all orders" ON public.marketplace_orders TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: doctor_payouts Admins can manage all payouts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all payouts" ON public.doctor_payouts USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: marketplace_products Admins can manage all products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all products" ON public.marketplace_products TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: marketplace_vendors Admins can manage all vendors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all vendors" ON public.marketplace_vendors TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: marketplace_categories Admins can manage categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage categories" ON public.marketplace_categories TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: doctor_profiles Admins can manage doctor profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage doctor profiles" ON public.doctor_profiles USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: featured_listings Admins can manage featured listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage featured listings" ON public.featured_listings TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: hospitals Admins can manage hospitals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage hospitals" ON public.hospitals TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: payout_settings Admins can manage payout settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage payout settings" ON public.payout_settings USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: ad_placements Admins can manage placements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage placements" ON public.ad_placements TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: doctor_ranks Admins can manage ranks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage ranks" ON public.doctor_ranks TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: resident_profiles Admins can manage resident profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage resident profiles" ON public.resident_profiles USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: hospital_reviews Admins can manage reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage reviews" ON public.hospital_reviews TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can manage roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage roles" ON public.user_roles USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: identity_verifications Admins can manage verifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage verifications" ON public.identity_verifications USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: arco_requests Admins can read ARCO requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read ARCO requests" ON public.arco_requests FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: site_settings Admins can read site settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read site settings" ON public.site_settings FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: arco_requests Admins can update ARCO requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update ARCO requests" ON public.arco_requests FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: ad_config Admins can update ad config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update ad config" ON public.ad_config FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: marketplace_orders Admins can update orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update orders" ON public.marketplace_orders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: reports Admins can update reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update reports" ON public.reports FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: refund_requests Admins can update requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update requests" ON public.refund_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: site_settings Admins can update site settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update site settings" ON public.site_settings FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_bank_accounts Admins can view all bank accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all bank accounts" ON public.user_bank_accounts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: cedula_verifications Admins can view all cedula verifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all cedula verifications" ON public.cedula_verifications FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: patient_clinical_history Admins can view all clinical histories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all clinical histories" ON public.patient_clinical_history FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: identity_verifications Admins can view all identity verifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all identity verifications" ON public.identity_verifications FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: marketplace_orders Admins can view all orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all orders" ON public.marketplace_orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: purchases Admins can view all purchases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all purchases" ON public.purchases FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: reports Admins can view all reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all reports" ON public.reports FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: document_signatures Admins can view all signatures; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all signatures" ON public.document_signatures FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: wallet_transactions Admins can view all wallet transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all wallet transactions" ON public.wallet_transactions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: featured_events Admins can view featured events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view featured events" ON public.featured_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: payout_settings Admins can view payout settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view payout settings" ON public.payout_settings FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: vault_audit_log Admins view all vault audit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins view all vault audit" ON public.vault_audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: ad_campaigns Advertisers see own campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Advertisers see own campaigns" ON public.ad_campaigns FOR SELECT TO authenticated USING (((advertiser_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: recordings Anyone can browse recordings catalog; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can browse recordings catalog" ON public.recordings FOR SELECT USING (true);


--
-- Name: ad_events Anyone can insert events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert events" ON public.ad_events FOR INSERT WITH CHECK (true);


--
-- Name: ad_config Anyone can read ad config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read ad config" ON public.ad_config FOR SELECT USING (true);


--
-- Name: exchange_rates Anyone can read exchange rates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read exchange rates" ON public.exchange_rates FOR SELECT USING (true);


--
-- Name: live_chat_messages Anyone can read live chat messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read live chat messages" ON public.live_chat_messages FOR SELECT TO authenticated USING (true);


--
-- Name: ad_placements Anyone can read placements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read placements" ON public.ad_placements FOR SELECT USING (true);


--
-- Name: doctor_ranks Anyone can read ranks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read ranks" ON public.doctor_ranks FOR SELECT TO authenticated USING (true);


--
-- Name: arco_requests Anyone can submit ARCO request; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can submit ARCO request" ON public.arco_requests FOR INSERT WITH CHECK (true);


--
-- Name: news_comments Anyone can view comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view comments" ON public.news_comments FOR SELECT USING (true);


--
-- Name: doctor_availability Anyone can view confirmed availability; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view confirmed availability" ON public.doctor_availability FOR SELECT USING ((status = ANY (ARRAY['scheduled'::public.availability_status, 'confirmed'::public.availability_status])));


--
-- Name: hospital_reviews Anyone can view hospital reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view hospital reviews" ON public.hospital_reviews FOR SELECT USING (true);


--
-- Name: live_likes Anyone can view likes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view likes" ON public.live_likes FOR SELECT USING (true);


--
-- Name: medical_news Anyone can view published news; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view published news" ON public.medical_news FOR SELECT USING ((is_published = true));


--
-- Name: doctor_certifications Approved certifications are public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved certifications are public" ON public.doctor_certifications FOR SELECT USING ((status = 'approved'::text));


--
-- Name: clinical_cases Approved doctors can create cases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved doctors can create cases" ON public.clinical_cases FOR INSERT WITH CHECK (((auth.uid() = author_id) AND public.is_approved_doctor(auth.uid())));


--
-- Name: clinical_sessions Approved doctors can create clinical sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved doctors can create clinical sessions" ON public.clinical_sessions FOR INSERT WITH CHECK (public.is_approved_doctor(auth.uid()));


--
-- Name: consultations Approved doctors can create consultations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved doctors can create consultations" ON public.consultations FOR INSERT WITH CHECK (((auth.uid() = doctor_id) AND public.is_approved_doctor(auth.uid())));


--
-- Name: lives Approved doctors can create lives; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved doctors can create lives" ON public.lives FOR INSERT WITH CHECK (public.is_approved_doctor(auth.uid()));


--
-- Name: doctor_education Approved education is public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved education is public" ON public.doctor_education FOR SELECT USING ((status = 'approved'::text));


--
-- Name: doctor_experience Approved experience is public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved experience is public" ON public.doctor_experience FOR SELECT USING ((status = 'approved'::text));


--
-- Name: lives Approved residents can create lives; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved residents can create lives" ON public.lives FOR INSERT WITH CHECK (public.is_approved_resident(auth.uid()));


--
-- Name: ad_campaigns Authenticated can create campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated can create campaigns" ON public.ad_campaigns FOR INSERT TO authenticated WITH CHECK ((advertiser_id = auth.uid()));


--
-- Name: expediente_otp Authenticated users can create OTP; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create OTP" ON public.expediente_otp FOR INSERT TO authenticated WITH CHECK (((auth.uid() = doctor_id) OR (auth.uid() = patient_id)));


--
-- Name: hospital_reviews Authenticated users can create reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create reviews" ON public.hospital_reviews FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: chat_sessions Authenticated users can create sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create sessions" ON public.chat_sessions FOR INSERT WITH CHECK ((auth.uid() = participant1_id));


--
-- Name: featured_events Authenticated users can insert own featured events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert own featured events" ON public.featured_events FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: live_likes Authenticated users can like; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can like" ON public.live_likes FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: news_comment_likes Authenticated users can view likes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view likes" ON public.news_comment_likes FOR SELECT TO authenticated USING (true);


--
-- Name: clinical_cases Authors and admins can delete cases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authors and admins can delete cases" ON public.clinical_cases FOR DELETE USING (((auth.uid() = author_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: clinical_case_comments Authors and admins can delete comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authors and admins can delete comments" ON public.clinical_case_comments FOR DELETE USING (((auth.uid() = author_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: clinical_cases Authors can update own cases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authors can update own cases" ON public.clinical_cases FOR UPDATE USING ((auth.uid() = author_id));


--
-- Name: clinical_case_comments Authors can update own comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authors can update own comments" ON public.clinical_case_comments FOR UPDATE USING ((auth.uid() = author_id));


--
-- Name: marketplace_orders Buyers can create orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Buyers can create orders" ON public.marketplace_orders FOR INSERT TO authenticated WITH CHECK ((auth.uid() = buyer_id));


--
-- Name: marketplace_orders Buyers can view own orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Buyers can view own orders" ON public.marketplace_orders FOR SELECT TO authenticated USING ((buyer_id = auth.uid()));


--
-- Name: lives Creators can delete own lives; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creators can delete own lives" ON public.lives FOR DELETE USING ((auth.uid() = doctor_id));


--
-- Name: doctor_content Creators can manage own content; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creators can manage own content" ON public.doctor_content USING ((auth.uid() = creator_id));


--
-- Name: recordings Creators can manage own recordings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creators can manage own recordings" ON public.recordings USING ((auth.uid() = doctor_id));


--
-- Name: lives Creators can update own lives; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creators can update own lives" ON public.lives FOR UPDATE USING ((auth.uid() = doctor_id));


--
-- Name: doctor_profiles Doctor profiles viewable by owner or admin only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctor profiles viewable by owner or admin only" ON public.doctor_profiles FOR SELECT USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: clinical_case_comments Doctors and residents can comment; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors and residents can comment" ON public.clinical_case_comments FOR INSERT WITH CHECK (((auth.uid() = author_id) AND (public.has_role(auth.uid(), 'doctor'::public.app_role) OR public.has_role(auth.uid(), 'resident'::public.app_role))));


--
-- Name: live_doctor_chat Doctors and residents can post side-chat; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors and residents can post side-chat" ON public.live_doctor_chat FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) AND (public.is_approved_doctor(auth.uid()) OR public.is_approved_resident(auth.uid()))));


--
-- Name: live_doctor_chat Doctors and residents can read side-chat; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors and residents can read side-chat" ON public.live_doctor_chat FOR SELECT TO authenticated USING ((public.is_approved_doctor(auth.uid()) OR public.is_approved_resident(auth.uid())));


--
-- Name: clinical_cases Doctors and residents can view cases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors and residents can view cases" ON public.clinical_cases FOR SELECT USING ((public.has_role(auth.uid(), 'doctor'::public.app_role) OR public.has_role(auth.uid(), 'resident'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: clinical_case_comments Doctors and residents can view comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors and residents can view comments" ON public.clinical_case_comments FOR SELECT USING ((public.has_role(auth.uid(), 'doctor'::public.app_role) OR public.has_role(auth.uid(), 'resident'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: prescriptions Doctors can create own prescriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can create own prescriptions" ON public.prescriptions FOR INSERT WITH CHECK ((auth.uid() = doctor_id));


--
-- Name: email_history Doctors can delete own email history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can delete own email history" ON public.email_history FOR DELETE TO authenticated USING ((auth.uid() = doctor_id));


--
-- Name: prescriptions Doctors can delete own prescriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can delete own prescriptions" ON public.prescriptions FOR DELETE USING ((auth.uid() = doctor_id));


--
-- Name: doctor_invoices Doctors can delete pending invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can delete pending invoices" ON public.doctor_invoices FOR DELETE USING (((auth.uid() = doctor_id) AND (status = 'pending'::text)));


--
-- Name: doctor_bank_accounts Doctors can insert own bank account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can insert own bank account" ON public.doctor_bank_accounts FOR INSERT WITH CHECK ((auth.uid() = doctor_id));


--
-- Name: doctor_availability Doctors can manage own availability; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can manage own availability" ON public.doctor_availability USING ((auth.uid() = doctor_id));


--
-- Name: doctor_certifications Doctors can manage own certifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can manage own certifications" ON public.doctor_certifications USING ((auth.uid() = doctor_id));


--
-- Name: doctor_education Doctors can manage own education; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can manage own education" ON public.doctor_education USING ((auth.uid() = doctor_id));


--
-- Name: doctor_experience Doctors can manage own experience; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can manage own experience" ON public.doctor_experience USING ((auth.uid() = doctor_id));


--
-- Name: doctor_resident_connections Doctors can respond to connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can respond to connections" ON public.doctor_resident_connections FOR UPDATE TO authenticated USING ((auth.uid() = doctor_id));


--
-- Name: notifications Doctors can send rating notifications to patients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can send rating notifications to patients" ON public.notifications FOR INSERT WITH CHECK (((type = 'rating_request'::public.notification_type) AND (EXISTS ( SELECT 1
   FROM public.chat_sessions cs
  WHERE (((cs.participant1_id = auth.uid()) OR (cs.participant2_id = auth.uid())) AND ((cs.participant1_id = notifications.user_id) OR (cs.participant2_id = notifications.user_id)) AND (auth.uid() <> notifications.user_id))))));


--
-- Name: notifications Doctors can send video call notifications to consultation patie; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can send video call notifications to consultation patie" ON public.notifications FOR INSERT WITH CHECK (((type = 'video_call'::public.notification_type) AND (EXISTS ( SELECT 1
   FROM public.consultations c
  WHERE ((c.doctor_id = auth.uid()) AND (c.patient_id = notifications.user_id) AND (c.status = 'active'::text))))));


--
-- Name: expediente_otp Doctors can update OTP; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can update OTP" ON public.expediente_otp FOR UPDATE USING ((auth.uid() = doctor_id));


--
-- Name: doctor_bank_accounts Doctors can update own bank account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can update own bank account" ON public.doctor_bank_accounts FOR UPDATE USING ((auth.uid() = doctor_id));


--
-- Name: prescriptions Doctors can update own prescriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can update own prescriptions" ON public.prescriptions FOR UPDATE USING ((auth.uid() = doctor_id)) WITH CHECK ((auth.uid() = doctor_id));


--
-- Name: doctor_profiles Doctors can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can update own profile" ON public.doctor_profiles FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: doctor_invoices Doctors can update pending invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can update pending invoices" ON public.doctor_invoices FOR UPDATE USING (((auth.uid() = doctor_id) AND (status = 'pending'::text)));


--
-- Name: doctor_invoices Doctors can upload invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can upload invoices" ON public.doctor_invoices FOR INSERT WITH CHECK ((auth.uid() = doctor_id));


--
-- Name: expediente_otp Doctors can view OTP for them; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can view OTP for them" ON public.expediente_otp FOR SELECT USING ((auth.uid() = doctor_id));


--
-- Name: clinical_sessions Doctors can view clinical sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can view clinical sessions" ON public.clinical_sessions FOR SELECT USING (((auth.uid() = organizer_id) OR public.user_is_clinical_session_participant(id, auth.uid())));


--
-- Name: vault_files Doctors can view files with active access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can view files with active access" ON public.vault_files FOR SELECT USING (public.user_has_vault_access(id, auth.uid()));


--
-- Name: vault_access Doctors can view own access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can view own access" ON public.vault_access FOR SELECT USING ((auth.uid() = doctor_id));


--
-- Name: doctor_bank_accounts Doctors can view own bank account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can view own bank account" ON public.doctor_bank_accounts FOR SELECT USING ((auth.uid() = doctor_id));


--
-- Name: email_history Doctors can view own email history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can view own email history" ON public.email_history FOR SELECT USING ((auth.uid() = doctor_id));


--
-- Name: fund_holds Doctors can view own holds; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can view own holds" ON public.fund_holds FOR SELECT USING ((auth.uid() = doctor_id));


--
-- Name: doctor_invoices Doctors can view own invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can view own invoices" ON public.doctor_invoices FOR SELECT USING ((auth.uid() = doctor_id));


--
-- Name: medical_news Doctors can view own news; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can view own news" ON public.medical_news FOR SELECT USING ((auth.uid() = created_by));


--
-- Name: doctor_payouts Doctors can view own payouts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can view own payouts" ON public.doctor_payouts FOR SELECT USING ((auth.uid() = doctor_id));


--
-- Name: prescriptions Doctors can view own prescriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can view own prescriptions" ON public.prescriptions FOR SELECT USING ((auth.uid() = doctor_id));


--
-- Name: purchases Doctors can view purchases on their recordings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can view purchases on their recordings" ON public.purchases FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.recordings r
  WHERE ((r.id = purchases.recording_id) AND (r.doctor_id = auth.uid())))));


--
-- Name: clinical_session_invitations Doctors can view relevant invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can view relevant invitations" ON public.clinical_session_invitations FOR SELECT USING (((auth.uid() = doctor_id) OR public.user_is_invitation_organizer(session_id, auth.uid())));


--
-- Name: email_history Doctors can view their own email history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can view their own email history" ON public.email_history FOR SELECT TO authenticated USING ((doctor_id = auth.uid()));


--
-- Name: live_consultation_requests Doctors can view their requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can view their requests" ON public.live_consultation_requests FOR SELECT TO authenticated USING ((doctor_id = auth.uid()));


--
-- Name: child_profiles Doctors read child records of active patients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors read child records of active patients" ON public.child_profiles FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.consultations c
  WHERE ((c.patient_id = child_profiles.parent_id) AND (c.doctor_id = auth.uid()) AND (c.status = ANY (ARRAY['active'::text, 'completed'::text]))))));


--
-- Name: patient_vaccinations Doctors read vaccinations of consulted patients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors read vaccinations of consulted patients" ON public.patient_vaccinations FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.consultations c
  WHERE ((c.patient_id = patient_vaccinations.patient_id) AND (c.doctor_id = auth.uid()) AND (c.status = ANY (ARRAY['active'::text, 'completed'::text]))))));


--
-- Name: medical_news Doctors with permission can delete own news; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors with permission can delete own news" ON public.medical_news FOR DELETE USING (((auth.uid() = created_by) AND (EXISTS ( SELECT 1
   FROM public.doctor_profiles
  WHERE ((doctor_profiles.user_id = auth.uid()) AND (doctor_profiles.can_publish_news = true) AND (doctor_profiles.status = 'approved'::public.doctor_status))))));


--
-- Name: medical_news Doctors with permission can insert news; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors with permission can insert news" ON public.medical_news FOR INSERT WITH CHECK (((auth.uid() = created_by) AND (EXISTS ( SELECT 1
   FROM public.doctor_profiles
  WHERE ((doctor_profiles.user_id = auth.uid()) AND (doctor_profiles.can_publish_news = true) AND (doctor_profiles.status = 'approved'::public.doctor_status))))));


--
-- Name: medical_news Doctors with permission can update own news; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors with permission can update own news" ON public.medical_news FOR UPDATE USING (((auth.uid() = created_by) AND (EXISTS ( SELECT 1
   FROM public.doctor_profiles
  WHERE ((doctor_profiles.user_id = auth.uid()) AND (doctor_profiles.can_publish_news = true) AND (doctor_profiles.status = 'approved'::public.doctor_status))))));


--
-- Name: patient_clinical_history Doctors with vault access can view clinical history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors with vault access can view clinical history" ON public.patient_clinical_history FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.vault_files vf
     JOIN public.vault_access va ON ((va.file_id = vf.id)))
  WHERE ((vf.patient_id = patient_clinical_history.patient_id) AND (va.doctor_id = auth.uid()) AND ((va.expires_at IS NULL) OR (va.expires_at > now()))))));


--
-- Name: email_history Email history is immutable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Email history is immutable" ON public.email_history FOR UPDATE TO authenticated USING (false);


--
-- Name: resident_group_members Everyone can view group members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view group members" ON public.resident_group_members FOR SELECT USING (true);


--
-- Name: resident_groups Everyone can view groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view groups" ON public.resident_groups FOR SELECT USING (true);


--
-- Name: resident_group_activity Group members can post activity; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can post activity" ON public.resident_group_activity FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.resident_group_members
  WHERE ((resident_group_members.group_id = resident_group_activity.group_id) AND (resident_group_members.user_id = auth.uid()))))));


--
-- Name: resident_group_activity Group members can view activity; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can view activity" ON public.resident_group_activity FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.resident_group_members
  WHERE ((resident_group_members.group_id = resident_group_activity.group_id) AND (resident_group_members.user_id = auth.uid())))));


--
-- Name: clinical_session_invitations Invited doctors can respond to invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Invited doctors can respond to invitations" ON public.clinical_session_invitations FOR UPDATE USING ((auth.uid() = doctor_id));


--
-- Name: lives Lives are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lives are viewable by everyone" ON public.lives FOR SELECT USING (true);


--
-- Name: resident_group_members Members can leave groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can leave groups" ON public.resident_group_members FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: email_history Only system can insert email history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only system can insert email history" ON public.email_history FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: clinical_session_invitations Organizers can invite approved doctors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Organizers can invite approved doctors" ON public.clinical_session_invitations FOR INSERT WITH CHECK ((public.user_is_invitation_organizer(session_id, auth.uid()) AND public.is_approved_doctor(doctor_id)));


--
-- Name: clinical_sessions Organizers can update own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Organizers can update own sessions" ON public.clinical_sessions FOR UPDATE USING ((auth.uid() = organizer_id));


--
-- Name: ad_campaigns Owners and admins can update campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and admins can update campaigns" ON public.ad_campaigns FOR UPDATE TO authenticated USING (((advertiser_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: ad_events Owners and admins read events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and admins read events" ON public.ad_events FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.ad_campaigns c
  WHERE ((c.id = ad_events.campaign_id) AND ((c.advertiser_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role))))));


--
-- Name: ad_payments Owners and admins read payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and admins read payments" ON public.ad_payments FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.ad_campaigns c
  WHERE ((c.id = ad_payments.campaign_id) AND ((c.advertiser_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role))))));


--
-- Name: ad_creatives Owners and admins update creatives; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and admins update creatives" ON public.ad_creatives FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.ad_campaigns c
  WHERE ((c.id = ad_creatives.campaign_id) AND ((c.advertiser_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role))))));


--
-- Name: ad_payments Owners can create payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can create payments" ON public.ad_payments FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.ad_campaigns c
  WHERE ((c.id = ad_payments.campaign_id) AND (c.advertiser_id = auth.uid())))));


--
-- Name: ad_creatives Owners can manage creatives; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can manage creatives" ON public.ad_creatives FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.ad_campaigns c
  WHERE ((c.id = ad_creatives.campaign_id) AND (c.advertiser_id = auth.uid())))));


--
-- Name: child_profiles Parents manage own children records delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Parents manage own children records delete" ON public.child_profiles FOR DELETE USING ((auth.uid() = parent_id));


--
-- Name: child_profiles Parents manage own children records insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Parents manage own children records insert" ON public.child_profiles FOR INSERT WITH CHECK ((auth.uid() = parent_id));


--
-- Name: child_profiles Parents manage own children records select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Parents manage own children records select" ON public.child_profiles FOR SELECT USING ((auth.uid() = parent_id));


--
-- Name: child_profiles Parents manage own children records update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Parents manage own children records update" ON public.child_profiles FOR UPDATE USING ((auth.uid() = parent_id));


--
-- Name: consultation_ratings Participants and admins view ratings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants and admins view ratings" ON public.consultation_ratings FOR SELECT TO authenticated USING (((auth.uid() = patient_id) OR (auth.uid() = doctor_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: chat_sessions Participants can delete closed sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants can delete closed sessions" ON public.chat_sessions FOR DELETE USING (((status = 'closed'::public.chat_status) AND ((auth.uid() = participant1_id) OR (auth.uid() = participant2_id))));


--
-- Name: consultations Participants can update consultations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants can update consultations" ON public.consultations FOR UPDATE USING (((auth.uid() = patient_id) OR (auth.uid() = doctor_id)));


--
-- Name: chat_messages Participants can update message read status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants can update message read status" ON public.chat_messages FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.chat_sessions
  WHERE ((chat_sessions.id = chat_messages.session_id) AND ((chat_sessions.participant1_id = auth.uid()) OR (chat_sessions.participant2_id = auth.uid()))))));


--
-- Name: chat_sessions Participants can update own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants can update own sessions" ON public.chat_sessions FOR UPDATE USING (((auth.uid() = participant1_id) OR (auth.uid() = participant2_id)));


--
-- Name: consultations Participants can view consultations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants can view consultations" ON public.consultations FOR SELECT USING (((auth.uid() = patient_id) OR (auth.uid() = doctor_id)));


--
-- Name: chat_messages Participants can view messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants can view messages" ON public.chat_messages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.chat_sessions
  WHERE ((chat_sessions.id = chat_messages.session_id) AND ((chat_sessions.participant1_id = auth.uid()) OR (chat_sessions.participant2_id = auth.uid()))))));


--
-- Name: chat_sessions Participants can view own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants can view own sessions" ON public.chat_sessions FOR SELECT USING (((auth.uid() = participant1_id) OR (auth.uid() = participant2_id)));


--
-- Name: prescriptions Patients can delete own prescriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Patients can delete own prescriptions" ON public.prescriptions FOR DELETE USING ((auth.uid() = patient_id));


--
-- Name: vault_access Patients can grant access to approved doctors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Patients can grant access to approved doctors" ON public.vault_access FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM public.vault_files
  WHERE ((vault_files.id = vault_access.file_id) AND (vault_files.patient_id = auth.uid())))) AND public.is_approved_doctor(doctor_id)));


--
-- Name: live_consultation_requests Patients can insert own requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Patients can insert own requests" ON public.live_consultation_requests FOR INSERT TO authenticated WITH CHECK ((patient_id = auth.uid()));


--
-- Name: patient_clinical_history Patients can manage own clinical history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Patients can manage own clinical history" ON public.patient_clinical_history USING ((auth.uid() = patient_id));


--
-- Name: medical_history Patients can manage own medical history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Patients can manage own medical history" ON public.medical_history USING ((auth.uid() = patient_id));


--
-- Name: vault_files Patients can manage own vault files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Patients can manage own vault files" ON public.vault_files USING ((auth.uid() = patient_id));


--
-- Name: consultation_ratings Patients can rate their consultations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Patients can rate their consultations" ON public.consultation_ratings FOR INSERT WITH CHECK (((auth.uid() = patient_id) AND (EXISTS ( SELECT 1
   FROM public.consultations
  WHERE ((consultations.id = consultation_ratings.consultation_id) AND (consultations.patient_id = auth.uid()) AND (consultations.status = 'completed'::text))))));


--
-- Name: vault_access Patients can revoke vault access for own files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Patients can revoke vault access for own files" ON public.vault_access FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.vault_files
  WHERE ((vault_files.id = vault_access.file_id) AND (vault_files.patient_id = auth.uid())))));


--
-- Name: consultation_ratings Patients can update own ratings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Patients can update own ratings" ON public.consultation_ratings FOR UPDATE USING ((auth.uid() = patient_id));


--
-- Name: expediente_otp Patients can view own OTP; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Patients can view own OTP" ON public.expediente_otp FOR SELECT USING ((auth.uid() = patient_id));


--
-- Name: patient_clinical_history Patients can view own clinical history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Patients can view own clinical history" ON public.patient_clinical_history FOR SELECT USING ((auth.uid() = patient_id));


--
-- Name: medical_history Patients can view own medical history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Patients can view own medical history" ON public.medical_history FOR SELECT USING ((auth.uid() = patient_id));


--
-- Name: prescriptions Patients can view own prescriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Patients can view own prescriptions" ON public.prescriptions FOR SELECT USING ((auth.uid() = patient_id));


--
-- Name: live_consultation_requests Patients can view own requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Patients can view own requests" ON public.live_consultation_requests FOR SELECT TO authenticated USING ((patient_id = auth.uid()));


--
-- Name: vault_files Patients can view own vault files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Patients can view own vault files" ON public.vault_files FOR SELECT USING ((auth.uid() = patient_id));


--
-- Name: vault_access Patients can view vault access for own files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Patients can view vault access for own files" ON public.vault_access FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.vault_files
  WHERE ((vault_files.id = vault_access.file_id) AND (vault_files.patient_id = auth.uid())))));


--
-- Name: patient_vaccinations Patients delete own vaccinations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Patients delete own vaccinations" ON public.patient_vaccinations FOR DELETE USING ((auth.uid() = patient_id));


--
-- Name: patient_vaccinations Patients insert own vaccinations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Patients insert own vaccinations" ON public.patient_vaccinations FOR INSERT WITH CHECK ((auth.uid() = patient_id));


--
-- Name: patient_vaccinations Patients select own vaccinations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Patients select own vaccinations" ON public.patient_vaccinations FOR SELECT USING ((auth.uid() = patient_id));


--
-- Name: patient_vaccinations Patients update own vaccinations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Patients update own vaccinations" ON public.patient_vaccinations FOR UPDATE USING ((auth.uid() = patient_id));


--
-- Name: vault_audit_log Patients view own vault audit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Patients view own vault audit" ON public.vault_audit_log FOR SELECT TO authenticated USING ((patient_id = auth.uid()));


--
-- Name: doctor_content Private content viewable by creator; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Private content viewable by creator" ON public.doctor_content FOR SELECT USING ((auth.uid() = creator_id));


--
-- Name: ad_campaigns Public can read active campaigns for ad delivery; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read active campaigns for ad delivery" ON public.ad_campaigns FOR SELECT USING ((status = 'active'::text));


--
-- Name: ad_creatives Public can read active creatives; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read active creatives" ON public.ad_creatives FOR SELECT USING ((is_active = true));


--
-- Name: ad_placements Public can read active placements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read active placements" ON public.ad_placements FOR SELECT USING ((is_active = true));


--
-- Name: ad_config Public can read ad config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read ad config" ON public.ad_config FOR SELECT USING (true);


--
-- Name: site_settings Public can read public settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read public settings" ON public.site_settings FOR SELECT USING ((id = ANY (ARRAY['social_links'::text, 'terms_of_service'::text, 'privacy_policy'::text, 'contact_info'::text, 'storage_pricing'::text])));


--
-- Name: marketplace_categories Public can view active categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view active categories" ON public.marketplace_categories FOR SELECT USING ((is_active = true));


--
-- Name: featured_listings Public can view active featured listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view active featured listings" ON public.featured_listings FOR SELECT USING ((is_active = true));


--
-- Name: hospitals Public can view active hospitals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view active hospitals" ON public.hospitals FOR SELECT USING ((is_active = true));


--
-- Name: marketplace_products Public can view active products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view active products" ON public.marketplace_products FOR SELECT USING ((is_active = true));


--
-- Name: marketplace_vendors Public can view approved vendors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view approved vendors" ON public.marketplace_vendors FOR SELECT USING ((status = 'approved'::text));


--
-- Name: doctor_content Public content filtered by audience; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public content filtered by audience" ON public.doctor_content FOR SELECT USING (((is_public = true) AND ((audience_type = 'all'::public.content_audience) OR ((audience_type = 'patients'::public.content_audience) AND (public.has_role(auth.uid(), 'patient'::public.app_role) OR public.has_role(auth.uid(), 'doctor'::public.app_role) OR public.has_role(auth.uid(), 'resident'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))) OR ((audience_type = 'professionals'::public.content_audience) AND (public.has_role(auth.uid(), 'doctor'::public.app_role) OR public.has_role(auth.uid(), 'resident'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))))));


--
-- Name: resident_profiles Resident profiles viewable by owner or admin only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Resident profiles viewable by owner or admin only" ON public.resident_profiles FOR SELECT USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: doctor_resident_connections Residents can cancel pending connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Residents can cancel pending connections" ON public.doctor_resident_connections FOR DELETE TO authenticated USING (((auth.uid() = resident_id) AND (status = 'pending'::text)));


--
-- Name: resident_group_members Residents can join groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Residents can join groups" ON public.resident_group_members FOR INSERT WITH CHECK (((auth.uid() = user_id) AND public.has_role(auth.uid(), 'resident'::public.app_role)));


--
-- Name: doctor_resident_connections Residents can request connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Residents can request connections" ON public.doctor_resident_connections FOR INSERT TO authenticated WITH CHECK ((auth.uid() = resident_id));


--
-- Name: resident_profiles Residents can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Residents can update own profile" ON public.resident_profiles FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: phone_verifications Service role can manage phone verifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage phone verifications" ON public.phone_verifications USING ((auth.uid() = user_id));


--
-- Name: chat_messages Session participants can send messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Session participants can send messages" ON public.chat_messages FOR INSERT WITH CHECK (((auth.uid() = sender_id) AND (EXISTS ( SELECT 1
   FROM public.chat_sessions
  WHERE ((chat_sessions.id = chat_messages.session_id) AND (chat_sessions.status = 'active'::public.chat_status) AND ((chat_sessions.participant1_id = auth.uid()) OR (chat_sessions.participant2_id = auth.uid())))))));


--
-- Name: referral_redemptions System can create redemptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can create redemptions" ON public.referral_redemptions FOR INSERT WITH CHECK ((auth.uid() = referred_user_id));


--
-- Name: entitlements System can manage entitlements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can manage entitlements" ON public.entitlements USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: refund_requests Users and admins can view requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users and admins can view requests" ON public.refund_requests FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: subscriptions Users can cancel own subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can cancel own subscriptions" ON public.subscriptions FOR UPDATE USING ((auth.uid() = subscriber_id));


--
-- Name: cedula_verifications Users can create cedula verifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create cedula verifications" ON public.cedula_verifications FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: news_comments Users can create own comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own comments" ON public.news_comments FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: notifications Users can create own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own notifications" ON public.notifications FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: referral_codes Users can create own referral codes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own referral codes" ON public.referral_codes FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: document_signatures Users can create own signatures; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own signatures" ON public.document_signatures FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: purchases Users can create purchases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create purchases" ON public.purchases FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: reports Users can create reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create reports" ON public.reports FOR INSERT TO authenticated WITH CHECK ((auth.uid() = reporter_id));


--
-- Name: identity_verifications Users can create verification requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create verification requests" ON public.identity_verifications FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: news_comments Users can delete own comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own comments" ON public.news_comments FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: notifications Users can delete own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: onboarding_progress Users can delete own onboarding progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own onboarding progress" ON public.onboarding_progress FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: hospital_reviews Users can delete own reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own reviews" ON public.hospital_reviews FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: followers Users can follow; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can follow" ON public.followers FOR INSERT WITH CHECK ((auth.uid() = follower_id));


--
-- Name: live_chat_messages Users can insert own chat messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own chat messages" ON public.live_chat_messages FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: doctor_profiles Users can insert own doctor profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own doctor profile" ON public.doctor_profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: onboarding_progress Users can insert own onboarding progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own onboarding progress" ON public.onboarding_progress FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: refund_requests Users can insert own requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own requests" ON public.refund_requests FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: resident_profiles Users can insert own resident profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own resident profile" ON public.resident_profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: wallets Users can insert own wallet; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own wallet" ON public.wallets FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: disclaimer_acceptances Users can insert their own disclaimer acceptances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own disclaimer acceptances" ON public.disclaimer_acceptances FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: news_comment_likes Users can like; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can like" ON public.news_comment_likes FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_bank_accounts Users can manage own bank account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own bank account" ON public.user_bank_accounts TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: user_blocks Users can manage own blocks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own blocks" ON public.user_blocks USING ((auth.uid() = blocker_id));


--
-- Name: notification_preferences Users can manage own preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own preferences" ON public.notification_preferences USING ((auth.uid() = user_id));


--
-- Name: push_subscriptions Users can manage own subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own subscriptions" ON public.push_subscriptions USING ((auth.uid() = user_id));


--
-- Name: subscriptions Users can subscribe to valid creators; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can subscribe to valid creators" ON public.subscriptions FOR INSERT WITH CHECK (((auth.uid() = subscriber_id) AND (public.is_approved_doctor(creator_id) OR public.is_approved_resident(creator_id))));


--
-- Name: followers Users can unfollow; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can unfollow" ON public.followers FOR DELETE USING ((auth.uid() = follower_id));


--
-- Name: news_comment_likes Users can unlike; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can unlike" ON public.news_comment_likes FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: live_likes Users can unlike own likes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can unlike own likes" ON public.live_likes FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: news_comments Users can update own comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own comments" ON public.news_comments FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: notifications Users can update own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: onboarding_progress Users can update own onboarding progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own onboarding progress" ON public.onboarding_progress FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: identity_verifications Users can update own pending verifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own pending verifications" ON public.identity_verifications FOR UPDATE USING (((auth.uid() = user_id) AND (status = 'pending'::public.identity_verification_status)));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: user_blocks Users can view if they are blocked; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view if they are blocked" ON public.user_blocks FOR SELECT USING ((auth.uid() = blocked_id));


--
-- Name: cedula_verifications Users can view own cedula verifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own cedula verifications" ON public.cedula_verifications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: doctor_resident_connections Users can view own connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own connections" ON public.doctor_resident_connections FOR SELECT TO authenticated USING (((auth.uid() = doctor_id) OR (auth.uid() = resident_id)));


--
-- Name: entitlements Users can view own entitlements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own entitlements" ON public.entitlements FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: notifications Users can view own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: onboarding_progress Users can view own onboarding progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own onboarding progress" ON public.onboarding_progress FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: phone_verifications Users can view own phone verifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own phone verifications" ON public.phone_verifications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: notification_preferences Users can view own preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own preferences" ON public.notification_preferences FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: purchases Users can view own purchases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own purchases" ON public.purchases FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: referral_redemptions Users can view own redemptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own redemptions" ON public.referral_redemptions FOR SELECT USING (((auth.uid() = referrer_user_id) OR (auth.uid() = referred_user_id)));


--
-- Name: referral_codes Users can view own referral codes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own referral codes" ON public.referral_codes FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: reports Users can view own reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own reports" ON public.reports FOR SELECT TO authenticated USING ((auth.uid() = reporter_id));


--
-- Name: user_roles Users can view own role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: document_signatures Users can view own signatures; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own signatures" ON public.document_signatures FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: subscriptions Users can view own subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own subscriptions" ON public.subscriptions FOR SELECT USING (((auth.uid() = subscriber_id) OR (auth.uid() = creator_id)));


--
-- Name: wallet_transactions Users can view own transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own transactions" ON public.wallet_transactions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: identity_verifications Users can view own verifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own verifications" ON public.identity_verifications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: wallets Users can view own wallet; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own wallet" ON public.wallets FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: disclaimer_acceptances Users can view their own disclaimer acceptances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own disclaimer acceptances" ON public.disclaimer_acceptances FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: followers Users see only their follow edges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users see only their follow edges" ON public.followers FOR SELECT TO authenticated USING (((auth.uid() = follower_id) OR (auth.uid() = followed_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: ad_creatives Users see own creatives; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users see own creatives" ON public.ad_creatives FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.ad_campaigns c
  WHERE ((c.id = ad_creatives.campaign_id) AND ((c.advertiser_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role))))));


--
-- Name: marketplace_vendors Vendor owners can manage own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Vendor owners can manage own" ON public.marketplace_vendors TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: marketplace_products Vendor owners can manage own products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Vendor owners can manage own products" ON public.marketplace_products TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.marketplace_vendors v
  WHERE ((v.id = marketplace_products.vendor_id) AND (v.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.marketplace_vendors v
  WHERE ((v.id = marketplace_products.vendor_id) AND (v.user_id = auth.uid())))));


--
-- Name: marketplace_orders Vendors can update order status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Vendors can update order status" ON public.marketplace_orders FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.marketplace_vendors v
  WHERE ((v.id = marketplace_orders.vendor_id) AND (v.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.marketplace_vendors v
  WHERE ((v.id = marketplace_orders.vendor_id) AND (v.user_id = auth.uid())))));


--
-- Name: marketplace_orders Vendors can view orders for their products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Vendors can view orders for their products" ON public.marketplace_orders FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.marketplace_vendors v
  WHERE ((v.id = marketplace_orders.vendor_id) AND (v.user_id = auth.uid())))));


--
-- Name: ad_campaigns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;

--
-- Name: ad_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ad_config ENABLE ROW LEVEL SECURITY;

--
-- Name: ad_creatives; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ad_creatives ENABLE ROW LEVEL SECURITY;

--
-- Name: ad_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ad_events ENABLE ROW LEVEL SECURITY;

--
-- Name: ad_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ad_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: ad_placements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ad_placements ENABLE ROW LEVEL SECURITY;

--
-- Name: arco_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.arco_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: cedula_verifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cedula_verifications ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: child_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.child_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: clinical_case_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clinical_case_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: clinical_cases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clinical_cases ENABLE ROW LEVEL SECURITY;

--
-- Name: clinical_session_invitations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clinical_session_invitations ENABLE ROW LEVEL SECURITY;

--
-- Name: clinical_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clinical_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: consultation_ratings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.consultation_ratings ENABLE ROW LEVEL SECURITY;

--
-- Name: consultations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;

--
-- Name: disclaimer_acceptances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.disclaimer_acceptances ENABLE ROW LEVEL SECURITY;

--
-- Name: doctor_availability; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.doctor_availability ENABLE ROW LEVEL SECURITY;

--
-- Name: doctor_bank_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.doctor_bank_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: doctor_certifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.doctor_certifications ENABLE ROW LEVEL SECURITY;

--
-- Name: doctor_content; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.doctor_content ENABLE ROW LEVEL SECURITY;

--
-- Name: doctor_education; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.doctor_education ENABLE ROW LEVEL SECURITY;

--
-- Name: doctor_experience; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.doctor_experience ENABLE ROW LEVEL SECURITY;

--
-- Name: doctor_invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.doctor_invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: doctor_payouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.doctor_payouts ENABLE ROW LEVEL SECURITY;

--
-- Name: doctor_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.doctor_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: doctor_ranks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.doctor_ranks ENABLE ROW LEVEL SECURITY;

--
-- Name: doctor_resident_connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.doctor_resident_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: document_signatures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_signatures ENABLE ROW LEVEL SECURITY;

--
-- Name: email_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_history ENABLE ROW LEVEL SECURITY;

--
-- Name: entitlements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;

--
-- Name: exchange_rates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

--
-- Name: expediente_otp; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.expediente_otp ENABLE ROW LEVEL SECURITY;

--
-- Name: featured_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.featured_events ENABLE ROW LEVEL SECURITY;

--
-- Name: featured_listings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.featured_listings ENABLE ROW LEVEL SECURITY;

--
-- Name: followers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;

--
-- Name: fund_holds; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fund_holds ENABLE ROW LEVEL SECURITY;

--
-- Name: hospital_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hospital_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: hospitals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;

--
-- Name: identity_verifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.identity_verifications ENABLE ROW LEVEL SECURITY;

--
-- Name: live_chat_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.live_chat_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: live_consultation_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.live_consultation_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: live_doctor_chat; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.live_doctor_chat ENABLE ROW LEVEL SECURITY;

--
-- Name: live_likes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.live_likes ENABLE ROW LEVEL SECURITY;

--
-- Name: lives; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lives ENABLE ROW LEVEL SECURITY;

--
-- Name: marketplace_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketplace_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: marketplace_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketplace_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: marketplace_products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketplace_products ENABLE ROW LEVEL SECURITY;

--
-- Name: marketplace_vendors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketplace_vendors ENABLE ROW LEVEL SECURITY;

--
-- Name: medical_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.medical_history ENABLE ROW LEVEL SECURITY;

--
-- Name: medical_news; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.medical_news ENABLE ROW LEVEL SECURITY;

--
-- Name: news_comment_likes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.news_comment_likes ENABLE ROW LEVEL SECURITY;

--
-- Name: news_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.news_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: onboarding_progress; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;

--
-- Name: patient_clinical_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patient_clinical_history ENABLE ROW LEVEL SECURITY;

--
-- Name: patient_vaccinations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patient_vaccinations ENABLE ROW LEVEL SECURITY;

--
-- Name: payout_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payout_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: phone_verifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;

--
-- Name: prescriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: purchases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

--
-- Name: push_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: recordings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;

--
-- Name: referral_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: referral_redemptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.referral_redemptions ENABLE ROW LEVEL SECURITY;

--
-- Name: refund_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

--
-- Name: resident_group_activity; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.resident_group_activity ENABLE ROW LEVEL SECURITY;

--
-- Name: resident_group_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.resident_group_members ENABLE ROW LEVEL SECURITY;

--
-- Name: resident_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.resident_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: resident_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.resident_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: site_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_bank_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_bank_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: user_blocks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: vault_access; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vault_access ENABLE ROW LEVEL SECURITY;

--
-- Name: vault_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vault_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: vault_files; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vault_files ENABLE ROW LEVEL SECURITY;

--
-- Name: wallet_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: wallets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict MGHWYAcBCMLQnAtPOt1Q6uC5NaNgdD3fODiq5gptKtDFphi1AwbXGXoa6Z8flog


-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit) VALUES ('ad-creatives', 'ad-creatives', 't', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit) VALUES ('avatars', 'avatars', 't', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit) VALUES ('doctor-content', 'doctor-content', 'f', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit) VALUES ('doctor-credentials', 'doctor-credentials', 'f', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit) VALUES ('doctor-invoices', 'doctor-invoices', 'f', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit) VALUES ('documents', 'documents', 'f', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit) VALUES ('email-assets', 'email-assets', 't', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit) VALUES ('identity-documents', 'identity-documents', 'f', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit) VALUES ('medical-history', 'medical-history', 'f', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit) VALUES ('prescriptions', 'prescriptions', 'f', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit) VALUES ('recordings', 'recordings', 'f', 524288000) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit) VALUES ('report-attachments', 'report-attachments', 'f', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit) VALUES ('thumbnails', 'thumbnails', 't', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit) VALUES ('vault-files', 'vault-files', 'f', NULL) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STORAGE POLICIES
-- ============================================================
DROP POLICY IF EXISTS "Ad creatives public read by path" ON storage.objects;
CREATE POLICY "Ad creatives public read by path" ON storage.objects FOR SELECT TO public
  USING (((bucket_id = 'ad-creatives'::text) AND ((storage.foldername(name))[1] IS NOT NULL)));
DROP POLICY IF EXISTS "Admin documents access" ON storage.objects;
CREATE POLICY "Admin documents access" ON storage.objects FOR ALL TO public
  USING (((bucket_id = 'documents'::text) AND has_role(auth.uid(), 'admin'::app_role)));
DROP POLICY IF EXISTS "Admins can view all credentials" ON storage.objects;
CREATE POLICY "Admins can view all credentials" ON storage.objects FOR SELECT TO public
  USING (((bucket_id = 'doctor-credentials'::text) AND has_role(auth.uid(), 'admin'::app_role)));
DROP POLICY IF EXISTS "Admins can view all doctor content" ON storage.objects;
CREATE POLICY "Admins can view all doctor content" ON storage.objects FOR SELECT TO public
  USING (((bucket_id = 'doctor-content'::text) AND has_role(auth.uid(), 'admin'::app_role)));
DROP POLICY IF EXISTS "Admins can view all invoices storage" ON storage.objects;
CREATE POLICY "Admins can view all invoices storage" ON storage.objects FOR SELECT TO public
  USING (((bucket_id = 'doctor-invoices'::text) AND has_role(auth.uid(), 'admin'::app_role)));
DROP POLICY IF EXISTS "Admins can view all recording files" ON storage.objects;
CREATE POLICY "Admins can view all recording files" ON storage.objects FOR SELECT TO authenticated
  USING (((bucket_id = 'recordings'::text) AND has_role(auth.uid(), 'admin'::app_role)));
DROP POLICY IF EXISTS "Admins can view all report attachments" ON storage.objects;
CREATE POLICY "Admins can view all report attachments" ON storage.objects FOR SELECT TO authenticated
  USING (((bucket_id = 'report-attachments'::text) AND has_role(auth.uid(), 'admin'::app_role)));
DROP POLICY IF EXISTS "Authenticated can upload ad creatives" ON storage.objects;
CREATE POLICY "Authenticated can upload ad creatives" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK ((bucket_id = 'ad-creatives'::text));
DROP POLICY IF EXISTS "Authenticated users can delete news images" ON storage.objects;
CREATE POLICY "Authenticated users can delete news images" ON storage.objects FOR DELETE TO public
  USING (((bucket_id = 'thumbnails'::text) AND ((storage.foldername(name))[1] = 'news'::text) AND (auth.uid() IS NOT NULL)));
DROP POLICY IF EXISTS "Authenticated users can update news images" ON storage.objects;
CREATE POLICY "Authenticated users can update news images" ON storage.objects FOR UPDATE TO public
  USING (((bucket_id = 'thumbnails'::text) AND ((storage.foldername(name))[1] = 'news'::text) AND (auth.uid() IS NOT NULL)));
DROP POLICY IF EXISTS "Authenticated users can upload news images" ON storage.objects;
CREATE POLICY "Authenticated users can upload news images" ON storage.objects FOR INSERT TO public
  WITH CHECK (((bucket_id = 'thumbnails'::text) AND ((storage.foldername(name))[1] = 'news'::text) AND (auth.uid() IS NOT NULL)));
DROP POLICY IF EXISTS "Authenticated users can upload report attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload report attachments" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'report-attachments'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
DROP POLICY IF EXISTS "Authenticated users can view public doctor content" ON storage.objects;
CREATE POLICY "Authenticated users can view public doctor content" ON storage.objects FOR SELECT TO public
  USING (((bucket_id = 'doctor-content'::text) AND (auth.role() = 'authenticated'::text) AND (EXISTS ( SELECT 1
   FROM doctor_content dc
  WHERE ((dc.file_url ~~ (('%'::text || storage.filename(objects.name)) || '%'::text)) AND (dc.is_public = true))))));
DROP POLICY IF EXISTS "Avatar images public read by path" ON storage.objects;
CREATE POLICY "Avatar images public read by path" ON storage.objects FOR SELECT TO public
  USING (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] IS NOT NULL)));
DROP POLICY IF EXISTS "Chat file delete" ON storage.objects;
CREATE POLICY "Chat file delete" ON storage.objects FOR DELETE TO public
  USING (((bucket_id = 'documents'::text) AND ((storage.foldername(name))[1] = 'chat'::text) AND ((storage.foldername(name))[3] = (auth.uid())::text)));
DROP POLICY IF EXISTS "Chat file upload" ON storage.objects;
CREATE POLICY "Chat file upload" ON storage.objects FOR INSERT TO public
  WITH CHECK (((bucket_id = 'documents'::text) AND (auth.uid() IS NOT NULL) AND ((storage.foldername(name))[1] = 'chat'::text) AND ((storage.foldername(name))[3] = (auth.uid())::text)));
DROP POLICY IF EXISTS "Chat file view" ON storage.objects;
CREATE POLICY "Chat file view" ON storage.objects FOR SELECT TO public
  USING (((bucket_id = 'documents'::text) AND (auth.uid() IS NOT NULL)));
DROP POLICY IF EXISTS "Chat participants can view session documents" ON storage.objects;
CREATE POLICY "Chat participants can view session documents" ON storage.objects FOR SELECT TO public
  USING (((bucket_id = 'documents'::text) AND ((storage.foldername(name))[1] = 'chat'::text) AND (EXISTS ( SELECT 1
   FROM chat_sessions cs
  WHERE (((cs.id)::text = (storage.foldername(objects.name))[2]) AND ((cs.participant1_id = auth.uid()) OR (cs.participant2_id = auth.uid())))))));
DROP POLICY IF EXISTS "Creators can upload thumbnails" ON storage.objects;
CREATE POLICY "Creators can upload thumbnails" ON storage.objects FOR INSERT TO public
  WITH CHECK (((bucket_id = 'thumbnails'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
DROP POLICY IF EXISTS "Doctors can delete own content" ON storage.objects;
CREATE POLICY "Doctors can delete own content" ON storage.objects FOR DELETE TO public
  USING (((bucket_id = 'doctor-content'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
DROP POLICY IF EXISTS "Doctors can delete own credentials" ON storage.objects;
CREATE POLICY "Doctors can delete own credentials" ON storage.objects FOR DELETE TO public
  USING (((bucket_id = 'doctor-credentials'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
DROP POLICY IF EXISTS "Doctors can delete own invoices" ON storage.objects;
CREATE POLICY "Doctors can delete own invoices" ON storage.objects FOR DELETE TO public
  USING (((bucket_id = 'doctor-invoices'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
DROP POLICY IF EXISTS "Doctors can delete own prescription files" ON storage.objects;
CREATE POLICY "Doctors can delete own prescription files" ON storage.objects FOR DELETE TO public
  USING (((bucket_id = 'prescriptions'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
DROP POLICY IF EXISTS "Doctors can delete own recordings" ON storage.objects;
CREATE POLICY "Doctors can delete own recordings" ON storage.objects FOR DELETE TO public
  USING (((bucket_id = 'recordings'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
DROP POLICY IF EXISTS "Doctors can delete own signatures" ON storage.objects;
CREATE POLICY "Doctors can delete own signatures" ON storage.objects FOR DELETE TO public
  USING (((bucket_id = 'documents'::text) AND ((storage.foldername(name))[1] = 'signatures'::text) AND ((storage.foldername(name))[2] = (auth.uid())::text) AND is_approved_doctor(auth.uid())));
DROP POLICY IF EXISTS "Doctors can manage own content" ON storage.objects;
CREATE POLICY "Doctors can manage own content" ON storage.objects FOR UPDATE TO public
  USING (((bucket_id = 'doctor-content'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
DROP POLICY IF EXISTS "Doctors can update own signatures" ON storage.objects;
CREATE POLICY "Doctors can update own signatures" ON storage.objects FOR UPDATE TO public
  USING (((bucket_id = 'documents'::text) AND ((storage.foldername(name))[1] = 'signatures'::text) AND ((storage.foldername(name))[2] = (auth.uid())::text) AND is_approved_doctor(auth.uid())));
DROP POLICY IF EXISTS "Doctors can upload content" ON storage.objects;
CREATE POLICY "Doctors can upload content" ON storage.objects FOR INSERT TO public
  WITH CHECK (((bucket_id = 'doctor-content'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
DROP POLICY IF EXISTS "Doctors can upload own credentials" ON storage.objects;
CREATE POLICY "Doctors can upload own credentials" ON storage.objects FOR INSERT TO public
  WITH CHECK (((bucket_id = 'doctor-credentials'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
DROP POLICY IF EXISTS "Doctors can upload own invoices" ON storage.objects;
CREATE POLICY "Doctors can upload own invoices" ON storage.objects FOR INSERT TO public
  WITH CHECK (((bucket_id = 'doctor-invoices'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
DROP POLICY IF EXISTS "Doctors can upload prescription files" ON storage.objects;
CREATE POLICY "Doctors can upload prescription files" ON storage.objects FOR INSERT TO public
  WITH CHECK (((bucket_id = 'prescriptions'::text) AND (auth.uid() IS NOT NULL) AND has_role(auth.uid(), 'doctor'::app_role)));
DROP POLICY IF EXISTS "Doctors can upload recordings" ON storage.objects;
CREATE POLICY "Doctors can upload recordings" ON storage.objects FOR INSERT TO public
  WITH CHECK (((bucket_id = 'recordings'::text) AND ((auth.uid())::text = (storage.foldername(name))[1]) AND ((EXISTS ( SELECT 1
   FROM doctor_profiles
  WHERE ((doctor_profiles.user_id = auth.uid()) AND (doctor_profiles.status = 'approved'::doctor_status)))) OR (EXISTS ( SELECT 1
   FROM resident_profiles
  WHERE ((resident_profiles.user_id = auth.uid()) AND (resident_profiles.status = 'approved'::doctor_status)))))));
DROP POLICY IF EXISTS "Doctors can upload signatures" ON storage.objects;
CREATE POLICY "Doctors can upload signatures" ON storage.objects FOR INSERT TO public
  WITH CHECK (((bucket_id = 'documents'::text) AND ((storage.foldername(name))[1] = 'signatures'::text) AND ((storage.foldername(name))[2] = (auth.uid())::text) AND is_approved_doctor(auth.uid())));
DROP POLICY IF EXISTS "Doctors can view own content files" ON storage.objects;
CREATE POLICY "Doctors can view own content files" ON storage.objects FOR SELECT TO public
  USING (((bucket_id = 'doctor-content'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
DROP POLICY IF EXISTS "Doctors can view own credentials" ON storage.objects;
CREATE POLICY "Doctors can view own credentials" ON storage.objects FOR SELECT TO public
  USING (((bucket_id = 'doctor-credentials'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
DROP POLICY IF EXISTS "Doctors can view own invoices" ON storage.objects;
CREATE POLICY "Doctors can view own invoices" ON storage.objects FOR SELECT TO public
  USING (((bucket_id = 'doctor-invoices'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
DROP POLICY IF EXISTS "Doctors can view own recording files" ON storage.objects;
CREATE POLICY "Doctors can view own recording files" ON storage.objects FOR SELECT TO authenticated
  USING (((bucket_id = 'recordings'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
DROP POLICY IF EXISTS "Doctors can view own signatures" ON storage.objects;
CREATE POLICY "Doctors can view own signatures" ON storage.objects FOR SELECT TO public
  USING (((bucket_id = 'documents'::text) AND ((storage.foldername(name))[1] = 'signatures'::text) AND ((storage.foldername(name))[2] = (auth.uid())::text)));
DROP POLICY IF EXISTS "Email assets public read by path" ON storage.objects;
CREATE POLICY "Email assets public read by path" ON storage.objects FOR SELECT TO public
  USING (((bucket_id = 'email-assets'::text) AND ((storage.foldername(name))[1] IS NOT NULL)));
DROP POLICY IF EXISTS "Owners can delete ad creatives" ON storage.objects;
CREATE POLICY "Owners can delete ad creatives" ON storage.objects FOR DELETE TO authenticated
  USING (((bucket_id = 'ad-creatives'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
DROP POLICY IF EXISTS "Owners can update ad creatives" ON storage.objects;
CREATE POLICY "Owners can update ad creatives" ON storage.objects FOR UPDATE TO authenticated
  USING (((bucket_id = 'ad-creatives'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
DROP POLICY IF EXISTS "Patients can access own medical history" ON storage.objects;
CREATE POLICY "Patients can access own medical history" ON storage.objects FOR SELECT TO public
  USING (((bucket_id = 'medical-history'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
DROP POLICY IF EXISTS "Patients can access own vault files" ON storage.objects;
CREATE POLICY "Patients can access own vault files" ON storage.objects FOR SELECT TO public
  USING (((bucket_id = 'vault-files'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
DROP POLICY IF EXISTS "Patients can delete own medical history" ON storage.objects;
CREATE POLICY "Patients can delete own medical history" ON storage.objects FOR DELETE TO public
  USING (((bucket_id = 'medical-history'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
DROP POLICY IF EXISTS "Patients can delete own vault files" ON storage.objects;
CREATE POLICY "Patients can delete own vault files" ON storage.objects FOR DELETE TO public
  USING (((bucket_id = 'vault-files'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
DROP POLICY IF EXISTS "Patients can upload medical history" ON storage.objects;
CREATE POLICY "Patients can upload medical history" ON storage.objects FOR INSERT TO public
  WITH CHECK (((bucket_id = 'medical-history'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
DROP POLICY IF EXISTS "Patients can upload vault files" ON storage.objects;
CREATE POLICY "Patients can upload vault files" ON storage.objects FOR INSERT TO public
  WITH CHECK (((bucket_id = 'vault-files'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
DROP POLICY IF EXISTS "Purchasers can view recording files" ON storage.objects;
CREATE POLICY "Purchasers can view recording files" ON storage.objects FOR SELECT TO authenticated
  USING (((bucket_id = 'recordings'::text) AND (EXISTS ( SELECT 1
   FROM (purchases p
     JOIN recordings r ON ((r.id = p.recording_id)))
  WHERE ((p.user_id = auth.uid()) AND ((r.video_url = objects.name) OR (storage.filename(r.video_url) = storage.filename(objects.name))))))));
DROP POLICY IF EXISTS "Thumbnails public read by path" ON storage.objects;
CREATE POLICY "Thumbnails public read by path" ON storage.objects FOR SELECT TO public
  USING (((bucket_id = 'thumbnails'::text) AND ((storage.foldername(name))[1] IS NOT NULL)));
DROP POLICY IF EXISTS "Users can access own documents" ON storage.objects;
CREATE POLICY "Users can access own documents" ON storage.objects FOR SELECT TO public
  USING (((bucket_id = 'documents'::text) AND ((auth.uid())::text = (storage.foldername(name))[2])));
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar" ON storage.objects FOR DELETE TO public
  USING (((bucket_id = 'avatars'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
DROP POLICY IF EXISTS "Users can delete their own identity documents" ON storage.objects;
CREATE POLICY "Users can delete their own identity documents" ON storage.objects FOR DELETE TO public
  USING (((bucket_id = 'identity-documents'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar" ON storage.objects FOR UPDATE TO public
  USING (((bucket_id = 'avatars'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar" ON storage.objects FOR INSERT TO public
  WITH CHECK (((bucket_id = 'avatars'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
DROP POLICY IF EXISTS "Users can upload their own identity documents" ON storage.objects;
CREATE POLICY "Users can upload their own identity documents" ON storage.objects FOR INSERT TO public
  WITH CHECK (((bucket_id = 'identity-documents'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
DROP POLICY IF EXISTS "Users can view own report attachments" ON storage.objects;
CREATE POLICY "Users can view own report attachments" ON storage.objects FOR SELECT TO authenticated
  USING (((bucket_id = 'report-attachments'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
DROP POLICY IF EXISTS "Users can view prescription files" ON storage.objects;
CREATE POLICY "Users can view prescription files" ON storage.objects FOR SELECT TO authenticated
  USING (((bucket_id = 'prescriptions'::text) AND (auth.uid() IS NOT NULL) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
   FROM prescriptions p
  WHERE ((p.patient_id = auth.uid()) AND (storage.filename(p.file_url) = storage.filename(objects.name))))))));
DROP POLICY IF EXISTS "Users can view their own identity documents" ON storage.objects;
CREATE POLICY "Users can view their own identity documents" ON storage.objects FOR SELECT TO public
  USING (((bucket_id = 'identity-documents'::text) AND (((auth.uid())::text = (storage.foldername(name))[1]) OR has_role(auth.uid(), 'admin'::app_role))));
DROP POLICY IF EXISTS "doctor-content restricted read" ON storage.objects;
CREATE POLICY "doctor-content restricted read" ON storage.objects FOR SELECT TO authenticated
  USING (((bucket_id = 'doctor-content'::text) AND (((auth.uid())::text = (storage.foldername(name))[1]) OR has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
   FROM doctor_content dc
  WHERE ((storage.filename(dc.file_url) = storage.filename(objects.name)) AND (((dc.is_public = true) AND ((dc.price IS NULL) OR (dc.price = (0)::numeric))) OR (dc.creator_id = auth.uid()) OR ((dc.is_public = true) AND (has_role(auth.uid(), 'doctor'::app_role) OR has_role(auth.uid(), 'admin'::app_role))))))))));

-- ============================================================
-- PG_CRON JOBS (require pg_cron extension; run after schema)
-- Replace SUPABASE_URL and ANON_KEY with new project values
-- ============================================================
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'send-availability-reminders',
  '*/5 * * * *',
  $$SELECT net.http_post(
    url := 'https://NEW_PROJECT.supabase.co/functions/v1/send-availability-reminders',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer NEW_ANON_KEY"}'::jsonb,
    body := '{}'::jsonb
  );$$
);

SELECT cron.schedule(
  'trigger-post-consultation-ratings',
  '*/5 * * * *',
  $$SELECT net.http_post(
    url := 'https://NEW_PROJECT.supabase.co/functions/v1/trigger-post-consultation-ratings',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer NEW_ANON_KEY"}'::jsonb,
    body := '{}'::jsonb
  );$$
);

SELECT cron.schedule(
  'send-vaccination-reminders-daily',
  '0 9 * * *',
  $$SELECT net.http_post(
    url := 'https://NEW_PROJECT.supabase.co/functions/v1/send-vaccination-reminders',
    headers := '{"Content-Type":"application/json","apikey":"NEW_ANON_KEY"}'::jsonb,
    body := jsonb_build_object('time', now())
  );$$
);
