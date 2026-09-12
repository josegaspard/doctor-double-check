-- =====================================================================
-- Reestructura del área del médico — contrato de base de datos
-- 12-sep-2026 · medical-masters.com (proyecto ouawwfqexfwuptlgoksr)
--
-- Migración ADITIVA e IDEMPOTENTE: se puede correr varias veces.
-- No borra ni reescribe ningún dato real (el único DELETE es de
-- notificaciones huérfanas, que hoy son 0).
--
-- Bloques:
--   1. Horario por día (doctor_schedule_ranges + get_doctor_schedule)
--   2. Nueva consulta creada por el médico (doctor_create_appointment)
--   3. Ficha del paciente (doctor_get_patient_overview)
--   4. Trayectoria publicada (is_public + get_doctor_public_credentials)
--   5. Colecciones de contenido
--   6. Cursos, lecciones e inscripciones (enroll_in_course)
--   7. Notificaciones: FK a auth.users y limpieza al borrar un post
--   8. Comunidad: 5.ª categoría diaria «caso_exito»
--   9. Permisos y recarga del esquema
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. HORARIO POR DÍA
--    El médico puede tener un horario distinto cada día de la semana y,
--    además, días sueltos del mes con su propio horario.
--    Regla: si una fecha concreta tiene filas, esas mandan y anulan por
--    completo las del día de la semana (si todas están inactivas, ese
--    día no atiende).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.doctor_schedule_ranges (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weekday       smallint,                 -- 0 = domingo … 6 = sábado
  specific_date date,                     -- día suelto del mes
  start_time    time NOT NULL,
  end_time      time NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,
  timezone      text NOT NULL DEFAULT 'America/Mexico_City',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Exactamente uno de los dos destinos, y el rango con sentido.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dsr_one_target') THEN
    ALTER TABLE public.doctor_schedule_ranges
      ADD CONSTRAINT dsr_one_target CHECK ((weekday IS NULL) <> (specific_date IS NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dsr_weekday_range') THEN
    ALTER TABLE public.doctor_schedule_ranges
      ADD CONSTRAINT dsr_weekday_range CHECK (weekday IS NULL OR (weekday BETWEEN 0 AND 6));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dsr_range') THEN
    ALTER TABLE public.doctor_schedule_ranges
      ADD CONSTRAINT dsr_range CHECK (end_time > start_time);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS dsr_doctor_weekday_idx
  ON public.doctor_schedule_ranges (doctor_id, weekday) WHERE weekday IS NOT NULL;
CREATE INDEX IF NOT EXISTS dsr_doctor_date_idx
  ON public.doctor_schedule_ranges (doctor_id, specific_date) WHERE specific_date IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS dsr_uniq_weekday
  ON public.doctor_schedule_ranges (doctor_id, weekday, start_time, end_time) WHERE weekday IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS dsr_uniq_date
  ON public.doctor_schedule_ranges (doctor_id, specific_date, start_time, end_time) WHERE specific_date IS NOT NULL;

ALTER TABLE public.doctor_schedule_ranges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dsr_public_read ON public.doctor_schedule_ranges;
CREATE POLICY dsr_public_read ON public.doctor_schedule_ranges
  FOR SELECT USING (true);

DROP POLICY IF EXISTS dsr_owner_all ON public.doctor_schedule_ranges;
CREATE POLICY dsr_owner_all ON public.doctor_schedule_ranges
  FOR ALL USING (doctor_id = (SELECT auth.uid()))
  WITH CHECK (doctor_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS dsr_admin_all ON public.doctor_schedule_ranges;
CREATE POLICY dsr_admin_all ON public.doctor_schedule_ranges
  FOR ALL USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

DROP TRIGGER IF EXISTS trg_dsr_updated_at ON public.doctor_schedule_ranges;
CREATE TRIGGER trg_dsr_updated_at
  BEFORE UPDATE ON public.doctor_schedule_ranges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Mantiene el resumen semanal antiguo (office_days / office_hours_*), que es
-- lo que siguen leyendo el directorio público y get_doctor_public_profile.
CREATE OR REPLACE FUNCTION public.sync_office_summary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doctor uuid := COALESCE(NEW.doctor_id, OLD.doctor_id);
  v_days text[];
  v_start time;
  v_end time;
BEGIN
  SELECT array_agg(DISTINCT (ARRAY['sunday','monday','tuesday','wednesday','thursday','friday','saturday'])[r.weekday + 1]),
         min(r.start_time), max(r.end_time)
    INTO v_days, v_start, v_end
    FROM public.doctor_schedule_ranges r
   WHERE r.doctor_id = v_doctor AND r.weekday IS NOT NULL AND r.is_active;

  -- Sin semana definida no se toca nada: el resumen antiguo sigue mandando.
  IF v_days IS NOT NULL THEN
    UPDATE public.doctor_profiles
       SET office_days = v_days,
           office_hours_start = v_start,
           office_hours_end = v_end
     WHERE user_id = v_doctor
       AND (office_days IS DISTINCT FROM v_days
         OR office_hours_start IS DISTINCT FROM v_start
         OR office_hours_end IS DISTINCT FROM v_end);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_dsr_sync_office ON public.doctor_schedule_ranges;
CREATE TRIGGER trg_dsr_sync_office
  AFTER INSERT OR UPDATE OR DELETE ON public.doctor_schedule_ranges
  FOR EACH ROW EXECUTE FUNCTION public.sync_office_summary();

-- Semilla idempotente: pasa el horario semanal antiguo a rangos, solo para
-- los médicos que todavía no tienen ninguno. No pisa nada de nadie.
INSERT INTO public.doctor_schedule_ranges (doctor_id, weekday, start_time, end_time)
SELECT dp.user_id,
       (array_position(ARRAY['sunday','monday','tuesday','wednesday','thursday','friday','saturday'], lower(d)) - 1)::smallint,
       COALESCE(dp.office_hours_start, time '08:00'),
       COALESCE(dp.office_hours_end, time '20:00')
  FROM public.doctor_profiles dp
  CROSS JOIN LATERAL unnest(COALESCE(dp.office_days, ARRAY[]::text[])) AS d
 WHERE dp.user_id IS NOT NULL
   AND lower(d) = ANY (ARRAY['sunday','monday','tuesday','wednesday','thursday','friday','saturday'])
   AND COALESCE(dp.office_hours_end, time '20:00') > COALESCE(dp.office_hours_start, time '08:00')
   AND NOT EXISTS (SELECT 1 FROM public.doctor_schedule_ranges r WHERE r.doctor_id = dp.user_id)
ON CONFLICT DO NOTHING;

-- Rangos efectivos por día en un intervalo.
-- source: 'date' (día suelto) · 'weekday' (semana) · 'legacy' (office_* antiguo).
CREATE OR REPLACE FUNCTION public.get_doctor_schedule(
  p_doctor_id uuid,
  p_from date,
  p_to date
)
RETURNS TABLE(day date, start_time time, end_time time, source text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT p_from AS d0, LEAST(p_to, p_from + 370) AS d1
  ),
  days AS (
    SELECT gs::date AS d
      FROM bounds, generate_series(bounds.d0, bounds.d1, interval '1 day') AS gs
     WHERE bounds.d1 >= bounds.d0
  ),
  has_ranges AS (
    SELECT EXISTS (SELECT 1 FROM public.doctor_schedule_ranges r WHERE r.doctor_id = p_doctor_id) AS v
  ),
  dated AS (
    SELECT DISTINCT d.d
      FROM days d
      JOIN public.doctor_schedule_ranges r
        ON r.doctor_id = p_doctor_id AND r.specific_date = d.d
  )
  SELECT d.d, r.start_time, r.end_time, 'date'::text
    FROM days d
    JOIN public.doctor_schedule_ranges r
      ON r.doctor_id = p_doctor_id AND r.specific_date = d.d AND r.is_active
  UNION ALL
  SELECT d.d, r.start_time, r.end_time, 'weekday'::text
    FROM days d
    JOIN public.doctor_schedule_ranges r
      ON r.doctor_id = p_doctor_id
     AND r.weekday = EXTRACT(DOW FROM d.d)::smallint
     AND r.is_active
   WHERE NOT EXISTS (SELECT 1 FROM dated x WHERE x.d = d.d)
  UNION ALL
  SELECT d.d, COALESCE(dp.office_hours_start, time '08:00'), COALESCE(dp.office_hours_end, time '20:00'), 'legacy'::text
    FROM days d
    JOIN public.doctor_profiles dp ON dp.user_id = p_doctor_id
   WHERE NOT (SELECT v FROM has_ranges)
     AND (ARRAY['sunday','monday','tuesday','wednesday','thursday','friday','saturday'])[EXTRACT(DOW FROM d.d)::int + 1]
         = ANY (SELECT lower(x) FROM unnest(COALESCE(dp.office_days, ARRAY[]::text[])) AS x)
     AND COALESCE(dp.office_hours_end, time '20:00') > COALESCE(dp.office_hours_start, time '08:00')
  ORDER BY 1, 2;
$$;

-- =====================================================================
-- 2. NUEVA CONSULTA CREADA POR EL MÉDICO
--    D1: nace PENDIENTE de que el paciente la acepte (status 'requested'
--        con created_by = el médico). Nunca queda confirmada de un lado.
--    D2: solo con pacientes con relación real.
-- =====================================================================

-- Modalidad y autoría de la cita (columnas nuevas, nadie las usaba).
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS modality text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS created_by uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_modality_check') THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_modality_check
      CHECK (modality IS NULL OR modality IN ('video','in_person'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_created_by_fkey') THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Una cita CONFIRMADA por hueco y médico. Las 'requested' no entran: varios
-- pacientes pueden pedir el mismo hueco y el médico elige (modelo actual).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_appointments_doctor_confirmed
  ON public.appointments (doctor_id, scheduled_at) WHERE status = 'confirmed';

-- Relación real médico-paciente (D2): consulta, cita, chat, expediente
-- compartido vigente o suscripción activa.
CREATE OR REPLACE FUNCTION public.doctor_has_patient_relation(p_doctor_id uuid, p_patient_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_doctor_id IS NULL OR p_patient_id IS NULL THEN false
    -- Nadie puede sondear la lista de pacientes de otro médico.
    WHEN p_doctor_id <> (SELECT auth.uid()) AND NOT public.has_role((SELECT auth.uid()), 'admin') THEN false
    ELSE (
      EXISTS (SELECT 1 FROM public.consultations c
               WHERE c.doctor_id = p_doctor_id AND c.patient_id = p_patient_id)
      OR EXISTS (SELECT 1 FROM public.appointments a
               WHERE a.doctor_id = p_doctor_id AND a.patient_id = p_patient_id)
      OR EXISTS (SELECT 1 FROM public.chat_sessions s
               WHERE (s.participant1_id = p_doctor_id AND s.participant2_id = p_patient_id)
                  OR (s.participant2_id = p_doctor_id AND s.participant1_id = p_patient_id))
      OR EXISTS (SELECT 1 FROM public.vault_access va
                   JOIN public.vault_files vf ON vf.id = va.file_id
                  WHERE va.doctor_id = p_doctor_id AND vf.patient_id = p_patient_id
                    AND (va.expires_at IS NULL OR va.expires_at > now()))
      OR EXISTS (SELECT 1 FROM public.subscriptions sub
                  WHERE sub.creator_id = p_doctor_id AND sub.subscriber_id = p_patient_id
                    AND sub.is_active)
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.doctor_create_appointment(
  p_patient_id uuid,
  p_starts_at timestamptz,
  p_duration_minutes int DEFAULT 30,
  p_notes text DEFAULT NULL,
  p_modality text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doctor   uuid := (SELECT auth.uid());
  v_minutes  int  := COALESCE(p_duration_minutes, 30);
  v_notes    text;
  v_modality text;
  v_end      timestamptz;
  v_id       uuid;
  v_name     text;
BEGIN
  IF v_doctor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_approved_doctor(v_doctor) THEN
    RAISE EXCEPTION 'not_approved_doctor' USING ERRCODE = '42501';
  END IF;
  IF p_patient_id IS NULL OR p_patient_id = v_doctor THEN
    RAISE EXCEPTION 'invalid_patient' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_patient_id) THEN
    RAISE EXCEPTION 'invalid_patient_not_found' USING ERRCODE = '23503';
  END IF;
  IF p_starts_at IS NULL OR p_starts_at <= now() THEN
    RAISE EXCEPTION 'invalid_datetime' USING ERRCODE = '22023';
  END IF;
  IF v_minutes NOT IN (15, 30, 45, 60) THEN
    RAISE EXCEPTION 'invalid_duration' USING ERRCODE = '22023';
  END IF;

  v_notes := NULLIF(btrim(COALESCE(p_notes, '')), '');
  IF v_notes IS NOT NULL AND char_length(v_notes) > 500 THEN
    RAISE EXCEPTION 'invalid_notes_too_long' USING ERRCODE = '22023';
  END IF;

  v_modality := NULLIF(btrim(lower(COALESCE(p_modality, ''))), '');
  IF v_modality IS NOT NULL THEN
    v_modality := CASE v_modality
      WHEN 'video' THEN 'video'
      WHEN 'online' THEN 'video'
      WHEN 'virtual' THEN 'video'
      WHEN 'videollamada' THEN 'video'
      WHEN 'in_person' THEN 'in_person'
      WHEN 'presencial' THEN 'in_person'
      WHEN 'office' THEN 'in_person'
      WHEN 'consultorio' THEN 'in_person'
      ELSE NULL
    END;
    IF v_modality IS NULL THEN
      RAISE EXCEPTION 'invalid_modality' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF NOT public.doctor_has_patient_relation(v_doctor, p_patient_id) THEN
    RAISE EXCEPTION 'no_patient_relation' USING ERRCODE = '42501';
  END IF;

  v_end := p_starts_at + make_interval(mins => v_minutes);
  PERFORM pg_advisory_xact_lock(hashtext('doctor_appt_' || v_doctor::text));

  IF EXISTS (
    SELECT 1 FROM public.appointments a
     WHERE a.doctor_id = v_doctor
       AND a.status IN ('requested', 'confirmed')
       AND a.scheduled_at < v_end
       AND (a.scheduled_at + make_interval(mins => a.duration_minutes)) > p_starts_at
  ) THEN
    RAISE EXCEPTION 'slot_taken' USING ERRCODE = '23505';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.doctor_availability d
     WHERE d.doctor_id = v_doctor
       AND d.type = 'blocked'
       AND d.status <> 'cancelled'
       AND d.scheduled_at < v_end
       AND (d.scheduled_at + make_interval(mins => d.duration_minutes)) > p_starts_at
  ) THEN
    RAISE EXCEPTION 'slot_blocked' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.appointments
    (patient_id, doctor_id, scheduled_at, duration_minutes, reason, status, modality, created_by)
  VALUES
    (p_patient_id, v_doctor, p_starts_at, v_minutes, v_notes, 'requested', v_modality, v_doctor)
  RETURNING id INTO v_id;

  SELECT NULLIF(name, '') INTO v_name FROM public.profiles WHERE id = v_doctor;

  -- Aviso al paciente. data.i18n lleva la clave; title/message quedan de
  -- respaldo por si la app no encuentra la traducción.
  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (
    p_patient_id,
    'system',
    'Nueva consulta propuesta',
    COALESCE(v_name, 'Tu médico') || ' te propone una consulta. Queda pendiente de que la aceptes.',
    jsonb_build_object(
      'kind', 'appointment_proposed_by_doctor',
      'appointment_id', v_id,
      'doctor_id', v_doctor,
      'starts_at', p_starts_at,
      'url', '/my-appointments',
      'deeplink', '/my-appointments',
      'i18n', jsonb_build_object(
        'title', 'mm2.db.notif.appointmentProposed.title',
        'message', 'mm2.db.notif.appointmentProposed.message',
        'params', jsonb_build_object('doctor', COALESCE(v_name, ''))
      )
    )
  );

  RETURN v_id;
END;
$$;

-- =====================================================================
-- 3. FICHA DEL PACIENTE (Resumen)
--    Identidad y contadores, solo con relación real. El correo y el
--    teléfono se devuelven con la MISMA regla que la policy de profiles
--    (expediente compartido vigente): esta función no abre más puerta.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.doctor_get_patient_overview(p_patient_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doctor   uuid := (SELECT auth.uid());
  v_unlocked boolean;
  v_p        record;
  v_out      jsonb;
BEGIN
  IF v_doctor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_approved_doctor(v_doctor) THEN
    RAISE EXCEPTION 'not_approved_doctor' USING ERRCODE = '42501';
  END IF;
  IF NOT public.doctor_has_patient_relation(v_doctor, p_patient_id) THEN
    RAISE EXCEPTION 'no_patient_relation' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.vault_access va
      JOIN public.vault_files vf ON vf.id = va.file_id
     WHERE va.doctor_id = v_doctor AND vf.patient_id = p_patient_id
       AND (va.expires_at IS NULL OR va.expires_at > now())
  ) INTO v_unlocked;

  SELECT id, name, avatar_url, email, phone, country_flag, is_identity_verified
    INTO v_p
    FROM public.profiles WHERE id = p_patient_id;

  IF v_p.id IS NULL THEN
    RAISE EXCEPTION 'invalid_patient_not_found' USING ERRCODE = '23503';
  END IF;

  SELECT jsonb_build_object(
    'patient', jsonb_build_object(
      'id', v_p.id,
      'name', NULLIF(v_p.name, ''),
      'avatar_url', v_p.avatar_url,
      'is_identity_verified', COALESCE(v_p.is_identity_verified, false),
      'email', CASE WHEN v_unlocked THEN v_p.email END,
      'phone', CASE WHEN v_unlocked THEN v_p.phone END,
      'country_flag', CASE WHEN v_unlocked THEN v_p.country_flag END,
      'contact_unlocked', v_unlocked
    ),
    'counters', jsonb_build_object(
      'consultations', (SELECT count(*) FROM public.consultations c
                         WHERE c.doctor_id = v_doctor AND c.patient_id = p_patient_id),
      'appointments', (SELECT count(*) FROM public.appointments a
                         WHERE a.doctor_id = v_doctor AND a.patient_id = p_patient_id),
      'appointments_upcoming', (SELECT count(*) FROM public.appointments a
                         WHERE a.doctor_id = v_doctor AND a.patient_id = p_patient_id
                           AND a.status IN ('requested','confirmed') AND a.scheduled_at >= now()),
      'appointments_pending', (SELECT count(*) FROM public.appointments a
                         WHERE a.doctor_id = v_doctor AND a.patient_id = p_patient_id
                           AND a.status = 'requested' AND a.scheduled_at >= now()),
      'prescriptions', (SELECT count(*) FROM public.prescriptions pr
                         WHERE pr.doctor_id = v_doctor AND pr.patient_id = p_patient_id),
      'shared_files', (SELECT count(*) FROM public.vault_access va
                         JOIN public.vault_files vf ON vf.id = va.file_id
                        WHERE va.doctor_id = v_doctor AND vf.patient_id = p_patient_id
                          AND (va.expires_at IS NULL OR va.expires_at > now())),
      'notes', (SELECT count(*) FROM public.doctor_notes dn
                         WHERE dn.doctor_id = v_doctor AND dn.patient_id = p_patient_id)
    ),
    'last_consultation_at', (SELECT max(COALESCE(c.completed_at, c.ended_at, c.started_at))
                               FROM public.consultations c
                              WHERE c.doctor_id = v_doctor AND c.patient_id = p_patient_id),
    'next_appointment_at', (SELECT min(a.scheduled_at) FROM public.appointments a
                              WHERE a.doctor_id = v_doctor AND a.patient_id = p_patient_id
                                AND a.status IN ('requested','confirmed') AND a.scheduled_at >= now()),
    'has_active_chat', EXISTS (SELECT 1 FROM public.chat_sessions s
                                WHERE ((s.participant1_id = v_doctor AND s.participant2_id = p_patient_id)
                                    OR (s.participant2_id = v_doctor AND s.participant1_id = p_patient_id))
                                  AND s.status = 'active'),
    'generated_at', now()
  ) INTO v_out;

  RETURN v_out;
END;
$$;

-- =====================================================================
-- 4. TRAYECTORIA: separar lo verificado de lo publicado
--    is_public = el médico decide si lo enseña. Las policies actuales
--    («Approved … is public») NO se tocan: solo se añade la vía limpia.
-- =====================================================================

ALTER TABLE public.doctor_education      ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;
ALTER TABLE public.doctor_experience     ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;
ALTER TABLE public.doctor_certifications ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'doctor_education_status_check') THEN
    ALTER TABLE public.doctor_education
      ADD CONSTRAINT doctor_education_status_check CHECK (status IN ('pending','approved','rejected'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'doctor_experience_status_check') THEN
    ALTER TABLE public.doctor_experience
      ADD CONSTRAINT doctor_experience_status_check CHECK (status IN ('pending','approved','rejected'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'doctor_certifications_status_check') THEN
    ALTER TABLE public.doctor_certifications
      ADD CONSTRAINT doctor_certifications_status_check CHECK (status IN ('pending','approved','rejected'));
  END IF;
END $$;

-- Solo lo aprobado Y publicado de un médico aprobado, y solo columnas públicas
-- (nada de admin_notes, document_url, reviewed_by ni credential_id).
CREATE OR REPLACE FUNCTION public.get_doctor_public_credentials(p_doctor_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'education', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', e.id, 'institution', e.institution, 'degree', e.degree,
               'field_of_study', e.field_of_study, 'start_year', e.start_year,
               'end_year', e.end_year, 'description', e.description)
             ORDER BY COALESCE(e.end_year, e.start_year, 0) DESC)
        FROM public.doctor_education e
       WHERE e.doctor_id = p_doctor_id AND e.status = 'approved' AND e.is_public
    ), '[]'::jsonb),
    'experience', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', x.id, 'title', x.title, 'organization', x.organization,
               'location', x.location, 'start_date', x.start_date, 'end_date', x.end_date,
               'is_current', x.is_current, 'description', x.description)
             ORDER BY x.is_current DESC NULLS LAST, x.start_date DESC NULLS LAST)
        FROM public.doctor_experience x
       WHERE x.doctor_id = p_doctor_id AND x.status = 'approved' AND x.is_public
    ), '[]'::jsonb),
    'certifications', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', c.id, 'name', c.name, 'issuing_organization', c.issuing_organization,
               'issue_date', c.issue_date, 'expiry_date', c.expiry_date)
             ORDER BY c.issue_date DESC NULLS LAST)
        FROM public.doctor_certifications c
       WHERE c.doctor_id = p_doctor_id AND c.status = 'approved' AND c.is_public
    ), '[]'::jsonb)
  )
  WHERE EXISTS (
    SELECT 1 FROM public.doctor_profiles dp
     WHERE dp.user_id = p_doctor_id AND dp.status = 'approved'
  );
$$;

-- =====================================================================
-- 5. COLECCIONES DE CONTENIDO
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.content_collections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  cover_url   text,
  is_public   boolean NOT NULL DEFAULT false,
  price       numeric NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'content_collections_title_check') THEN
    ALTER TABLE public.content_collections
      ADD CONSTRAINT content_collections_title_check
      CHECK (char_length(btrim(title)) BETWEEN 1 AND 200);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'content_collections_price_check') THEN
    ALTER TABLE public.content_collections
      ADD CONSTRAINT content_collections_price_check CHECK (price >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS content_collections_owner_idx ON public.content_collections (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS content_collections_public_idx ON public.content_collections (is_public) WHERE is_public;

CREATE TABLE IF NOT EXISTS public.content_collection_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES public.content_collections(id) ON DELETE CASCADE,
  item_type     text NOT NULL,
  item_id       uuid NOT NULL,
  position      int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'content_collection_items_type_check') THEN
    ALTER TABLE public.content_collection_items
      ADD CONSTRAINT content_collection_items_type_check
      CHECK (item_type IN ('content','recording','live','book'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS cci_uniq_item
  ON public.content_collection_items (collection_id, item_type, item_id);
CREATE INDEX IF NOT EXISTS cci_collection_idx
  ON public.content_collection_items (collection_id, position);

ALTER TABLE public.content_collections      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_collection_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cc_owner_all ON public.content_collections;
CREATE POLICY cc_owner_all ON public.content_collections
  FOR ALL USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS cc_public_read ON public.content_collections;
CREATE POLICY cc_public_read ON public.content_collections
  FOR SELECT USING (is_public);

DROP POLICY IF EXISTS cc_admin_all ON public.content_collections;
CREATE POLICY cc_admin_all ON public.content_collections
  FOR ALL USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

DROP POLICY IF EXISTS cci_owner_all ON public.content_collection_items;
CREATE POLICY cci_owner_all ON public.content_collection_items
  FOR ALL USING (EXISTS (SELECT 1 FROM public.content_collections c
                          WHERE c.id = collection_id AND c.owner_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.content_collections c
                       WHERE c.id = collection_id AND c.owner_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS cci_public_read ON public.content_collection_items;
CREATE POLICY cci_public_read ON public.content_collection_items
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.content_collections c
                             WHERE c.id = collection_id AND c.is_public));

DROP POLICY IF EXISTS cci_admin_all ON public.content_collection_items;
CREATE POLICY cci_admin_all ON public.content_collection_items
  FOR ALL USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

DROP TRIGGER IF EXISTS trg_cc_updated_at ON public.content_collections;
CREATE TRIGGER trg_cc_updated_at
  BEFORE UPDATE ON public.content_collections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- 6. CURSOS, LECCIONES E INSCRIPCIONES
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.courses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category     text NOT NULL DEFAULT 'curso',
  title        text NOT NULL,
  description  text,
  cover_url    text,
  level        text,
  price        numeric NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'courses_category_check') THEN
    ALTER TABLE public.courses
      ADD CONSTRAINT courses_category_check CHECK (category IN ('curso','masterclass','material'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'courses_title_check') THEN
    ALTER TABLE public.courses
      ADD CONSTRAINT courses_title_check CHECK (char_length(btrim(title)) BETWEEN 1 AND 200);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'courses_price_check') THEN
    ALTER TABLE public.courses ADD CONSTRAINT courses_price_check CHECK (price >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'courses_level_check') THEN
    ALTER TABLE public.courses
      ADD CONSTRAINT courses_level_check
      CHECK (level IS NULL OR level IN ('basico','intermedio','avanzado'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS courses_creator_idx ON public.courses (creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS courses_published_idx ON public.courses (category, created_at DESC) WHERE is_published;

CREATE TABLE IF NOT EXISTS public.course_lessons (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id        uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  position         int NOT NULL DEFAULT 0,
  title            text NOT NULL,
  description      text,
  item_type        text NOT NULL DEFAULT 'link',
  item_id          uuid,
  url              text,
  duration_minutes int
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_lessons_item_type_check') THEN
    ALTER TABLE public.course_lessons
      ADD CONSTRAINT course_lessons_item_type_check
      CHECK (item_type IN ('content','recording','live','book','file','link'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_lessons_title_check') THEN
    ALTER TABLE public.course_lessons
      ADD CONSTRAINT course_lessons_title_check CHECK (char_length(btrim(title)) BETWEEN 1 AND 200);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS course_lessons_course_idx ON public.course_lessons (course_id, position);

CREATE TABLE IF NOT EXISTS public.course_enrollments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  progress    jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS course_enrollments_uniq ON public.course_enrollments (course_id, user_id);
CREATE INDEX IF NOT EXISTS course_enrollments_user_idx ON public.course_enrollments (user_id, enrolled_at DESC);

ALTER TABLE public.courses            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_lessons     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS courses_owner_all ON public.courses;
CREATE POLICY courses_owner_all ON public.courses
  FOR ALL USING (creator_id = (SELECT auth.uid()))
  WITH CHECK (creator_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS courses_public_read ON public.courses;
CREATE POLICY courses_public_read ON public.courses
  FOR SELECT USING (is_published);

DROP POLICY IF EXISTS courses_admin_all ON public.courses;
CREATE POLICY courses_admin_all ON public.courses
  FOR ALL USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

DROP POLICY IF EXISTS course_lessons_owner_all ON public.course_lessons;
CREATE POLICY course_lessons_owner_all ON public.course_lessons
  FOR ALL USING (EXISTS (SELECT 1 FROM public.courses c
                          WHERE c.id = course_id AND c.creator_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses c
                       WHERE c.id = course_id AND c.creator_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS course_lessons_public_read ON public.course_lessons;
CREATE POLICY course_lessons_public_read ON public.course_lessons
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.courses c
                             WHERE c.id = course_id AND c.is_published));

DROP POLICY IF EXISTS course_lessons_admin_all ON public.course_lessons;
CREATE POLICY course_lessons_admin_all ON public.course_lessons
  FOR ALL USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

-- Las inscripciones NO tienen policy de INSERT a propósito: se crean solo
-- por enroll_in_course, que comprueba que el curso sea publicado y gratuito.
DROP POLICY IF EXISTS course_enrollments_read ON public.course_enrollments;
CREATE POLICY course_enrollments_read ON public.course_enrollments
  FOR SELECT USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.courses c
                WHERE c.id = course_id AND c.creator_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS course_enrollments_update_own ON public.course_enrollments;
CREATE POLICY course_enrollments_update_own ON public.course_enrollments
  FOR UPDATE USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS course_enrollments_delete_own ON public.course_enrollments;
CREATE POLICY course_enrollments_delete_own ON public.course_enrollments
  FOR DELETE USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS course_enrollments_admin_all ON public.course_enrollments;
CREATE POLICY course_enrollments_admin_all ON public.course_enrollments
  FOR ALL USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

DROP TRIGGER IF EXISTS trg_courses_updated_at ON public.courses;
CREATE TRIGGER trg_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.enroll_in_course(p_course_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user   uuid := (SELECT auth.uid());
  v_course record;
  v_id     uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT id, is_published, COALESCE(price, 0) AS price
    INTO v_course
    FROM public.courses WHERE id = p_course_id;

  IF v_course.id IS NULL THEN
    RAISE EXCEPTION 'course_not_found' USING ERRCODE = '23503';
  END IF;
  IF NOT v_course.is_published THEN
    RAISE EXCEPTION 'course_not_published' USING ERRCODE = '42501';
  END IF;
  IF v_course.price > 0 THEN
    RAISE EXCEPTION 'paid_course_requires_purchase' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.course_enrollments (course_id, user_id)
  VALUES (p_course_id, v_user)
  ON CONFLICT (course_id, user_id) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.course_enrollments
     WHERE course_id = p_course_id AND user_id = v_user;
  END IF;

  RETURN v_id;
END;
$$;

-- =====================================================================
-- 7. NOTIFICACIONES: integridad
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'notifications_user_id_fkey'
       AND conrelid = 'public.notifications'::regclass
  ) THEN
    -- Primero fuera las huérfanas (sin FK nadie las limpiaba).
    DELETE FROM public.notifications n
     WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = n.user_id);
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Al borrar una publicación del foro se van sus avisos.
CREATE OR REPLACE FUNCTION public.forum_post_cleanup_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.notifications
   WHERE data ->> 'post_id' = OLD.id::text;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_forum_post_cleanup_notifications ON public.forum_posts;
CREATE TRIGGER trg_forum_post_cleanup_notifications
  AFTER DELETE ON public.forum_posts
  FOR EACH ROW EXECUTE FUNCTION public.forum_post_cleanup_notifications();

CREATE INDEX IF NOT EXISTS notifications_post_id_idx
  ON public.notifications ((data ->> 'post_id')) WHERE data ? 'post_id';

-- =====================================================================
-- 8. COMUNIDAD: 5.ª categoría diaria «caso_exito»
--    Los CHECK ya la admiten; faltaba el banco y el reparto diario.
-- =====================================================================

INSERT INTO public.forum_prompt_bank (category, title)
SELECT 'caso_exito', t
  FROM (VALUES
    ('Un paciente que llegó sin esperanza y salió adelante: ¿qué cambió el rumbo?'),
    ('La cirugía que te salió mejor de lo que esperabas: ¿qué hiciste distinto?'),
    ('Un diagnóstico difícil que acertaste a tiempo: ¿qué te puso sobre la pista?'),
    ('Una rehabilitación larga con final feliz: ¿cómo sostuviste la adherencia?'),
    ('El caso en el que trabajar en equipo salvó el resultado: ¿cómo se repartió?'),
    ('Un tratamiento conservador que evitó el quirófano: ¿cuándo decidiste no operar?'),
    ('La consulta a distancia que resolvió un caso complejo: ¿qué te bastó para decidir?'),
    ('Un paciente que volvió a su trabajo o a su deporte: ¿cuánto tardó y con qué plan?'),
    ('Una complicación que atajaste a tiempo y terminó bien: ¿qué señal la delató?'),
    ('El caso del que más aprendiste este año: ¿qué te llevas para el siguiente?')
  ) AS v(t)
 WHERE NOT EXISTS (
   SELECT 1 FROM public.forum_prompt_bank b
    WHERE b.category = 'caso_exito' AND b.title = v.t
 );

CREATE OR REPLACE FUNCTION public.forum_publish_daily(
  p_date date DEFAULT ((now() AT TIME ZONE 'America/Mexico_City'::text))::date,
  p_notify boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cat text; _bank record; _created int := 0; _notified int := 0; _title text;
  _already boolean; _hour int;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_forum_member(auth.uid()) THEN
    RETURN jsonb_build_object('skipped', 'not_member');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('forum_daily_' || p_date::text));
  INSERT INTO public.forum_daily_runs (prompt_date) VALUES (p_date) ON CONFLICT DO NOTHING;
  SELECT notified > 0 INTO _already FROM public.forum_daily_runs WHERE prompt_date = p_date;

  -- 12-sep-2026: se suma 'caso_exito' como 5.ª categoría del día.
  FOREACH _cat IN ARRAY ARRAY['caso_clinico', 'complicacion', 'perla_quirurgica', 'innovacion', 'caso_exito'] LOOP
    IF NOT EXISTS (SELECT 1 FROM public.forum_daily_prompts WHERE prompt_date = p_date AND category = _cat) THEN
      SELECT * INTO _bank FROM public.forum_prompt_bank
      WHERE category = _cat AND is_active
      ORDER BY last_used_on NULLS FIRST, use_count, random() LIMIT 1;
      IF FOUND THEN
        INSERT INTO public.forum_daily_prompts (prompt_date, category, title, body, source, bank_id)
        VALUES (p_date, _cat, _bank.title, _bank.body, 'bank', _bank.id)
        ON CONFLICT (prompt_date, category) DO NOTHING;
        UPDATE public.forum_prompt_bank SET last_used_on = p_date, use_count = use_count + 1 WHERE id = _bank.id;
        _created := _created + 1;
      END IF;
    END IF;
  END LOOP;

  _hour := EXTRACT(HOUR FROM (now() AT TIME ZONE 'America/Mexico_City'))::int;
  IF p_notify AND NOT COALESCE(_already, false)
     AND p_date = (now() AT TIME ZONE 'America/Mexico_City')::date
     AND (auth.uid() IS NULL OR _hour >= 7) THEN
    SELECT title INTO _title FROM public.forum_daily_prompts WHERE prompt_date = p_date AND category = 'caso_clinico';
    INSERT INTO public.notifications (user_id, type, title, message, data)
    SELECT u.user_id, 'system', 'Hoy en Medical Masters',
           COALESCE(left(_title, 140), 'Caso, complicación, técnica, innovación y caso de éxito del día te esperan en la Comunidad.'),
           jsonb_build_object('kind', 'forum_daily', 'date', p_date, 'url', '/foro', 'deeplink', '/foro',
                              'i18n', jsonb_build_object(
                                'title', 'mm2.db.notif.forumDaily.title',
                                'message', 'mm2.db.notif.forumDaily.message',
                                'params', jsonb_build_object('prompt', COALESCE(left(_title, 140), ''))))
    FROM (
      SELECT dp.user_id FROM public.doctor_profiles dp WHERE dp.status = 'approved'
      UNION
      SELECT rp.user_id FROM public.resident_profiles rp WHERE rp.status = 'approved'
    ) u;
    GET DIAGNOSTICS _notified = ROW_COUNT;
    UPDATE public.forum_daily_runs
      SET prompts_created = prompts_created + _created, notified = GREATEST(_notified, 1), ran_at = now()
      WHERE prompt_date = p_date;
  ELSE
    UPDATE public.forum_daily_runs SET prompts_created = prompts_created + _created WHERE prompt_date = p_date;
  END IF;

  RETURN jsonb_build_object('date', p_date, 'created', _created, 'notified', _notified);
END;
$$;

-- =====================================================================
-- 9. PERMISOS
-- =====================================================================

GRANT SELECT ON public.doctor_schedule_ranges TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.doctor_schedule_ranges TO authenticated;

GRANT SELECT ON public.content_collections, public.content_collection_items TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.content_collections, public.content_collection_items TO authenticated;

GRANT SELECT ON public.courses, public.course_lessons TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.courses, public.course_lessons TO authenticated;
GRANT SELECT, UPDATE, DELETE ON public.course_enrollments TO authenticated;

REVOKE ALL ON FUNCTION public.doctor_create_appointment(uuid, timestamptz, int, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.doctor_create_appointment(uuid, timestamptz, int, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.doctor_has_patient_relation(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.doctor_has_patient_relation(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.doctor_get_patient_overview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.doctor_get_patient_overview(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.enroll_in_course(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enroll_in_course(uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_doctor_schedule(uuid, date, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_doctor_public_credentials(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.sync_office_summary() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.forum_post_cleanup_notifications() FROM PUBLIC, anon, authenticated;

COMMIT;

-- PostgREST tiene que ver los objetos nuevos en su caché de esquema.
NOTIFY pgrst, 'reload schema';
