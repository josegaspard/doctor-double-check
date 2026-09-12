-- =====================================================================
-- Invitaciones de pacientes («Importar datos» en Mis pacientes)
-- 13-sep-2026 · medical-masters.com (proyecto ouawwfqexfwuptlgoksr)
--
-- Migración ADITIVA e IDEMPOTENTE: se puede correr varias veces.
-- No borra ni reescribe ningún dato existente.
--
-- Un médico NO crea cuentas de otras personas. Sube su lista (CSV o pegada
-- desde Excel) y se crean INVITACIONES. Cuando esa persona abre su enlace
-- (/app?invitacion=<token>), inicia sesión como paciente y acepta, queda
-- vinculada al médico con un seguimiento gratuito en `subscriptions`
-- (tier 'free', is_active): es lo mismo que hace el botón «Seguir» y es una
-- de las relaciones que `doctor_has_patient_relation` (20260912) ya cuenta
-- como relación real. Con esa relación el médico ve nombre y foto; correo,
-- teléfono y expediente siguen privados hasta que el paciente los comparta
-- (doctor_get_patient_overview).
--
-- Bloques:
--   1. Tabla doctor_patient_invites + RLS + permisos por columna
--   2. doctor_import_patient_invites(p_rows jsonb)   (médico aprobado)
--   3. get_patient_invite(p_token text)              (anon: solo datos del médico)
--   4. accept_patient_invite(p_token text)           (paciente autenticado)
--   5. Permisos y recarga del esquema
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. TABLA
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.doctor_patient_invites (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name    text NOT NULL,
  email        text,
  phone        text,
  note         text,
  -- 2 UUID v4 sin guiones = 64 caracteres hex (≈244 bits aleatorios de
  -- gen_random_uuid, que usa el generador fuerte de Postgres; sin pgcrypto).
  token        text NOT NULL UNIQUE
               DEFAULT (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  status       text NOT NULL DEFAULT 'pending',
  sent_at      timestamptz,
  accepted_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dpi_status_check') THEN
    ALTER TABLE public.doctor_patient_invites
      ADD CONSTRAINT dpi_status_check CHECK (status IN ('pending', 'sent', 'accepted', 'revoked'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dpi_name_len') THEN
    ALTER TABLE public.doctor_patient_invites
      ADD CONSTRAINT dpi_name_len CHECK (char_length(btrim(full_name)) BETWEEN 2 AND 120);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dpi_contact_required') THEN
    ALTER TABLE public.doctor_patient_invites
      ADD CONSTRAINT dpi_contact_required CHECK (email IS NOT NULL OR phone IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dpi_email_format') THEN
    ALTER TABLE public.doctor_patient_invites
      ADD CONSTRAINT dpi_email_format CHECK (
        email IS NULL OR (
          char_length(email) <= 254
          AND email = lower(email)
          AND email ~ '^[a-z0-9._%+''-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$'
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dpi_phone_format') THEN
    ALTER TABLE public.doctor_patient_invites
      ADD CONSTRAINT dpi_phone_format CHECK (phone IS NULL OR phone ~ '^\+?[0-9]{8,15}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dpi_note_len') THEN
    ALTER TABLE public.doctor_patient_invites
      ADD CONSTRAINT dpi_note_len CHECK (note IS NULL OR char_length(note) <= 500);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dpi_token_len') THEN
    ALTER TABLE public.doctor_patient_invites
      ADD CONSTRAINT dpi_token_len CHECK (token ~ '^[A-Za-z0-9]{32,128}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dpi_accepted_consistency') THEN
    ALTER TABLE public.doctor_patient_invites
      ADD CONSTRAINT dpi_accepted_consistency CHECK (status <> 'accepted' OR accepted_at IS NOT NULL);
  END IF;
END $$;

-- Un correo por médico (cuando hay correo).
CREATE UNIQUE INDEX IF NOT EXISTS dpi_doctor_email_uniq
  ON public.doctor_patient_invites (doctor_id, lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS dpi_doctor_status_idx
  ON public.doctor_patient_invites (doctor_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS dpi_doctor_phone_idx
  ON public.doctor_patient_invites (doctor_id, phone) WHERE phone IS NOT NULL;

ALTER TABLE public.doctor_patient_invites ENABLE ROW LEVEL SECURITY;

-- El médico gestiona las suyas. Nadie más las lee (el paciente solo ve, por
-- RPC, el nombre y la especialidad del médico).
DROP POLICY IF EXISTS dpi_owner_select ON public.doctor_patient_invites;
CREATE POLICY dpi_owner_select ON public.doctor_patient_invites
  FOR SELECT USING (doctor_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS dpi_owner_insert ON public.doctor_patient_invites;
CREATE POLICY dpi_owner_insert ON public.doctor_patient_invites
  FOR INSERT WITH CHECK (
    doctor_id = (SELECT auth.uid())
    AND status = 'pending'
    AND accepted_by IS NULL
    AND accepted_at IS NULL
    AND public.is_approved_doctor((SELECT auth.uid()))
  );

-- Una invitación ya aceptada no se toca; nadie la marca «aceptada» a mano.
DROP POLICY IF EXISTS dpi_owner_update ON public.doctor_patient_invites;
CREATE POLICY dpi_owner_update ON public.doctor_patient_invites
  FOR UPDATE USING (doctor_id = (SELECT auth.uid()) AND status <> 'accepted')
  WITH CHECK (doctor_id = (SELECT auth.uid()) AND status IN ('pending', 'sent', 'revoked'));

DROP POLICY IF EXISTS dpi_owner_delete ON public.doctor_patient_invites;
CREATE POLICY dpi_owner_delete ON public.doctor_patient_invites
  FOR DELETE USING (doctor_id = (SELECT auth.uid()) AND status <> 'accepted');

DROP POLICY IF EXISTS dpi_admin_select ON public.doctor_patient_invites;
CREATE POLICY dpi_admin_select ON public.doctor_patient_invites
  FOR SELECT USING (public.has_role((SELECT auth.uid()), 'admin'));

-- Permisos por columna: el token, el médico dueño y los campos de aceptación
-- solo los escriben las funciones de abajo (o el service role de la Edge
-- Function send-patient-invite, que marca `sent`).
REVOKE ALL ON public.doctor_patient_invites FROM anon;
REVOKE INSERT, UPDATE ON public.doctor_patient_invites FROM authenticated;
GRANT SELECT, DELETE ON public.doctor_patient_invites TO authenticated;
GRANT INSERT (doctor_id, full_name, email, phone, note) ON public.doctor_patient_invites TO authenticated;
GRANT UPDATE (full_name, email, phone, note, status) ON public.doctor_patient_invites TO authenticated;
GRANT ALL ON public.doctor_patient_invites TO service_role;

COMMENT ON TABLE public.doctor_patient_invites IS
  'Invitaciones de pacientes creadas por un médico (Importar datos / Añadir paciente, 13-sep-2026). Aceptar = seguimiento gratuito en subscriptions.';

-- =====================================================================
-- 2. IMPORTAR (valida, deduplica, máx. 500 filas)
--    p_rows = [{ "full_name": "…", "email": "…", "phone": "…", "note": "…" }, …]
--    Devuelve { created, reactivated, duplicates, invalid, total,
--               rows: [{ row, result: created|duplicate|invalid, reason?, id? }] }
--    `created` incluye las reactivadas (una invitación revocada que se vuelve
--    a importar recupera el estado pendiente con un enlace NUEVO).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.doctor_import_patient_invites(p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doctor       uuid := (SELECT auth.uid());
  v_doctor_email text;
  v_total        int;
  v_row          jsonb;
  v_idx          int := 0;
  v_name         text;
  v_email        text;
  v_phone        text;
  v_note         text;
  v_reason       text;
  v_existing     public.doctor_patient_invites%ROWTYPE;
  v_seen_emails  text[] := ARRAY[]::text[];
  v_seen_phones  text[] := ARRAY[]::text[];
  v_created      int := 0;
  v_reactivated  int := 0;
  v_duplicates   int := 0;
  v_invalid      int := 0;
  v_results      jsonb := '[]'::jsonb;
  v_id           uuid;
BEGIN
  IF v_doctor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_approved_doctor(v_doctor) THEN
    RAISE EXCEPTION 'not_approved_doctor' USING ERRCODE = '42501';
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
  END IF;
  v_total := jsonb_array_length(p_rows);
  IF v_total = 0 THEN
    RAISE EXCEPTION 'invalid_payload_empty' USING ERRCODE = '22023';
  END IF;
  IF v_total > 500 THEN
    RAISE EXCEPTION 'too_many_rows' USING ERRCODE = '22023';
  END IF;

  -- Una importación a la vez por médico: dos pestañas no duplican filas.
  PERFORM pg_advisory_xact_lock(hashtext('doctor_patient_invites_' || v_doctor::text));

  SELECT NULLIF(lower(btrim(COALESCE(email, ''))), '') INTO v_doctor_email
    FROM public.profiles WHERE id = v_doctor;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    v_idx := v_idx + 1;
    v_reason := NULL;

    IF jsonb_typeof(v_row) <> 'object' THEN
      v_invalid := v_invalid + 1;
      v_results := v_results || jsonb_build_object('row', v_idx, 'result', 'invalid', 'reason', 'not_object');
      CONTINUE;
    END IF;

    -- Limpieza: sin caracteres de control y con los espacios colapsados.
    v_name := NULLIF(btrim(regexp_replace(
                regexp_replace(COALESCE(v_row->>'full_name', ''), '[[:cntrl:]]', ' ', 'g'),
                '\s+', ' ', 'g')), '');
    v_email := NULLIF(lower(btrim(COALESCE(v_row->>'email', ''))), '');
    v_phone := NULLIF(regexp_replace(COALESCE(v_row->>'phone', ''), '[^0-9+]', '', 'g'), '');
    IF v_phone IS NOT NULL THEN
      -- El «+» solo vale al principio.
      v_phone := CASE WHEN left(v_phone, 1) = '+'
                      THEN '+' || replace(substr(v_phone, 2), '+', '')
                      ELSE replace(v_phone, '+', '') END;
      IF v_phone IN ('', '+') THEN v_phone := NULL; END IF;
    END IF;
    v_note := NULLIF(btrim(regexp_replace(COALESCE(v_row->>'note', ''), '[[:cntrl:]]', ' ', 'g')), '');

    IF v_name IS NULL OR char_length(v_name) < 2 THEN
      v_reason := 'name_missing';
    ELSIF char_length(v_name) > 120 THEN
      v_reason := 'name_too_long';
    ELSIF v_email IS NULL AND v_phone IS NULL THEN
      v_reason := 'contact_missing';
    ELSIF v_email IS NOT NULL AND (
            char_length(v_email) > 254
            OR v_email !~ '^[a-z0-9._%+''-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$') THEN
      v_reason := 'email_invalid';
    ELSIF v_phone IS NOT NULL AND v_phone !~ '^\+?[0-9]{8,15}$' THEN
      v_reason := 'phone_invalid';
    ELSIF v_note IS NOT NULL AND char_length(v_note) > 500 THEN
      v_reason := 'note_too_long';
    ELSIF v_email IS NOT NULL AND v_email = v_doctor_email THEN
      v_reason := 'own_email';
    END IF;

    IF v_reason IS NOT NULL THEN
      v_invalid := v_invalid + 1;
      v_results := v_results || jsonb_build_object('row', v_idx, 'result', 'invalid', 'reason', v_reason);
      CONTINUE;
    END IF;

    -- Repetida dentro de la misma lista (por correo; sin correo, por teléfono).
    IF (v_email IS NOT NULL AND v_email = ANY (v_seen_emails))
       OR (v_email IS NULL AND v_phone = ANY (v_seen_phones)) THEN
      v_duplicates := v_duplicates + 1;
      v_results := v_results || jsonb_build_object('row', v_idx, 'result', 'duplicate', 'reason', 'repeated_in_file');
      CONTINUE;
    END IF;
    IF v_email IS NOT NULL THEN v_seen_emails := array_append(v_seen_emails, v_email); END IF;
    IF v_phone IS NOT NULL THEN v_seen_phones := array_append(v_seen_phones, v_phone); END IF;

    -- Ya es paciente de este médico (relación real). Solo se mira la relación
    -- con ESTE médico: no se revela si un correo tiene cuenta en la plataforma.
    IF v_email IS NOT NULL AND EXISTS (
         SELECT 1 FROM public.profiles p
          WHERE lower(p.email) = v_email
            AND p.id <> v_doctor
            AND public.doctor_has_patient_relation(v_doctor, p.id)) THEN
      v_duplicates := v_duplicates + 1;
      v_results := v_results || jsonb_build_object('row', v_idx, 'result', 'duplicate', 'reason', 'already_patient');
      CONTINUE;
    END IF;

    -- Invitación previa del mismo médico.
    IF v_email IS NOT NULL THEN
      SELECT * INTO v_existing FROM public.doctor_patient_invites
       WHERE doctor_id = v_doctor AND lower(email) = v_email
       LIMIT 1;
    ELSE
      SELECT * INTO v_existing FROM public.doctor_patient_invites
       WHERE doctor_id = v_doctor AND email IS NULL AND phone = v_phone AND status <> 'revoked'
       ORDER BY created_at DESC
       LIMIT 1;
    END IF;

    IF FOUND THEN
      IF v_existing.status = 'revoked' THEN
        UPDATE public.doctor_patient_invites
           SET full_name = v_name,
               phone     = COALESCE(v_phone, phone),
               note      = COALESCE(v_note, note),
               status    = 'pending',
               sent_at   = NULL,
               token     = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
         WHERE id = v_existing.id;
        v_reactivated := v_reactivated + 1;
        v_results := v_results || jsonb_build_object('row', v_idx, 'result', 'created', 'reason', 'reactivated', 'id', v_existing.id);
      ELSE
        v_duplicates := v_duplicates + 1;
        v_results := v_results || jsonb_build_object(
          'row', v_idx, 'result', 'duplicate',
          'reason', CASE WHEN v_existing.status = 'accepted' THEN 'already_accepted' ELSE 'already_invited' END,
          'id', v_existing.id);
      END IF;
      CONTINUE;
    END IF;

    BEGIN
      INSERT INTO public.doctor_patient_invites (doctor_id, full_name, email, phone, note)
      VALUES (v_doctor, v_name, v_email, v_phone, v_note)
      RETURNING id INTO v_id;
      v_created := v_created + 1;
      v_results := v_results || jsonb_build_object('row', v_idx, 'result', 'created', 'id', v_id);
    EXCEPTION WHEN unique_violation THEN
      v_duplicates := v_duplicates + 1;
      v_results := v_results || jsonb_build_object('row', v_idx, 'result', 'duplicate', 'reason', 'already_invited');
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'created',     v_created + v_reactivated,
    'reactivated', v_reactivated,
    'duplicates',  v_duplicates,
    'invalid',     v_invalid,
    'total',       v_total,
    'rows',        v_results
  );
END;
$$;

-- =====================================================================
-- 3. VISTA PREVIA PÚBLICA DEL ENLACE (anon)
--    Solo datos públicos del médico. NUNCA nombre, correo, teléfono ni nota
--    de la persona invitada.
--    status: pending | sent | accepted | revoked | not_found | unavailable
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_patient_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token  text := btrim(COALESCE(p_token, ''));
  v_doctor uuid;
  v_status text;
  v_name   text;
  v_avatar text;
  v_spec   text;
BEGIN
  IF v_token !~ '^[A-Za-z0-9]{32,128}$' THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT i.doctor_id, i.status INTO v_doctor, v_status
    FROM public.doctor_patient_invites i
   WHERE i.token = v_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  IF v_status = 'revoked' THEN
    RETURN jsonb_build_object('status', 'revoked');
  END IF;
  IF NOT public.is_approved_doctor(v_doctor) THEN
    RETURN jsonb_build_object('status', 'unavailable');
  END IF;

  SELECT NULLIF(btrim(p.name), ''), p.avatar_url INTO v_name, v_avatar
    FROM public.profiles p WHERE p.id = v_doctor;
  SELECT NULLIF(btrim(dp.specialty), '') INTO v_spec
    FROM public.doctor_profiles dp WHERE dp.user_id = v_doctor;

  RETURN jsonb_build_object(
    'status',            v_status,
    'doctor_id',         v_doctor,
    'doctor_name',       v_name,
    'doctor_specialty',  v_spec,
    'doctor_avatar_url', v_avatar
  );
END;
$$;

-- =====================================================================
-- 4. ACEPTAR (paciente autenticado)
--    Marca la invitación como aceptada y crea la relación real con el médico:
--    seguimiento gratuito en subscriptions (tier 'free'), igual que «Seguir».
--    Una suscripción ACTIVA (gratis o de pago) se deja como está; una
--    inactiva se reactiva como gratuita. Avisa al médico en notifications.
--    Devuelve { ok, reason: accepted|already_accepted|not_found|revoked|
--               already_used|own_invite|not_patient|doctor_unavailable,
--               relation?: followed|reactivated|existing, doctor_id?, doctor_name? }
-- =====================================================================

CREATE OR REPLACE FUNCTION public.accept_patient_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user         uuid := (SELECT auth.uid());
  v_token        text := btrim(COALESCE(p_token, ''));
  v_inv          public.doctor_patient_invites%ROWTYPE;
  v_sub_id       uuid;
  v_sub_active   boolean;
  v_relation     text;
  v_patient_name text;
  v_doctor_name  text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF v_token !~ '^[A-Za-z0-9]{32,128}$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT * INTO v_inv FROM public.doctor_patient_invites WHERE token = v_token FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT NULLIF(btrim(name), '') INTO v_doctor_name FROM public.profiles WHERE id = v_inv.doctor_id;

  IF v_inv.status = 'revoked' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'revoked');
  END IF;
  IF v_inv.status = 'accepted' THEN
    IF v_inv.accepted_by = v_user THEN
      RETURN jsonb_build_object('ok', true, 'reason', 'already_accepted',
                                'doctor_id', v_inv.doctor_id, 'doctor_name', v_doctor_name);
    END IF;
    RETURN jsonb_build_object('ok', false, 'reason', 'already_used');
  END IF;
  IF v_inv.doctor_id = v_user THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'own_invite');
  END IF;
  IF NOT public.has_role(v_user, 'patient') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_patient');
  END IF;
  IF NOT public.is_approved_doctor(v_inv.doctor_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'doctor_unavailable');
  END IF;

  SELECT s.id, s.is_active INTO v_sub_id, v_sub_active
    FROM public.subscriptions s
   WHERE s.subscriber_id = v_user AND s.creator_id = v_inv.doctor_id
   ORDER BY s.is_active DESC, s.created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF v_sub_id IS NULL THEN
    INSERT INTO public.subscriptions (subscriber_id, creator_id, tier, price_paid, is_active)
    VALUES (v_user, v_inv.doctor_id, 'free', 0, true)
    ON CONFLICT DO NOTHING;
    v_relation := 'followed';
  ELSIF NOT v_sub_active THEN
    UPDATE public.subscriptions
       SET is_active = true, tier = 'free', price_paid = 0, expires_at = NULL
     WHERE id = v_sub_id;
    v_relation := 'reactivated';
  ELSE
    v_relation := 'existing';
  END IF;

  UPDATE public.doctor_patient_invites
     SET status = 'accepted', accepted_by = v_user, accepted_at = now()
   WHERE id = v_inv.id;

  SELECT NULLIF(btrim(name), '') INTO v_patient_name FROM public.profiles WHERE id = v_user;

  -- Aviso al médico. Si falla, la aceptación sigue en pie.
  BEGIN
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
      v_inv.doctor_id,
      'system',
      'Invitación aceptada',
      COALESCE(v_patient_name, v_inv.full_name) || ' aceptó tu invitación y ya aparece en Mis pacientes.',
      jsonb_build_object(
        'kind', 'patient_invite_accepted',
        'invite_id', v_inv.id,
        'patient_id', v_user,
        'url', '/doctor/patients',
        'deeplink', '/doctor/patients',
        'i18n', jsonb_build_object(
          'title', 'mm2.db.notif.patientInviteAccepted.title',
          'message', 'mm2.db.notif.patientInviteAccepted.message',
          'params', jsonb_build_object('patient', COALESCE(v_patient_name, v_inv.full_name))
        )
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'accept_patient_invite: aviso al médico no creado (%)', SQLERRM;
  END;

  RETURN jsonb_build_object('ok', true, 'reason', 'accepted', 'relation', v_relation,
                            'doctor_id', v_inv.doctor_id, 'doctor_name', v_doctor_name);
END;
$$;

-- =====================================================================
-- 5. PERMISOS Y RECARGA DEL ESQUEMA
-- =====================================================================

REVOKE ALL ON FUNCTION public.doctor_import_patient_invites(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.doctor_import_patient_invites(jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.get_patient_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_patient_invite(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.accept_patient_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_patient_invite(text) TO authenticated;

COMMIT;

-- Recarga del esquema de PostgREST (fuera de la transacción).
NOTIFY pgrst, 'reload schema';
