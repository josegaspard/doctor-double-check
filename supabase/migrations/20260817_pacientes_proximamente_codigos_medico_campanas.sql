-- ════════════════════════════════════════════════════════════════════════════
-- 2026-08-17 · Tres peticiones del cliente en una sola migración
--   1) PACIENTES EN "PRÓXIMAMENTE": no se pueden registrar (ni entrar).
--   2) CÓDIGO POR MÉDICO: OBS-001 + nº global. Sólo lo ve el súper admin.
--   3) CAMPAÑAS DE REGISTRO: códigos de 50 en 50 / 100 en 100 con precio propio.
-- Todo es ADITIVO: no borra ni renombra nada existente.
-- ════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) PACIENTES EN "PRÓXIMAMENTE"
-- ─────────────────────────────────────────────────────────────────────────────
-- El interruptor vive donde ya viven los demás: site_settings/feature_toggles.
-- Así el súper admin abre el registro de pacientes el día del lanzamiento con
-- UN switch en Ajustes del sitio, sin desplegar código.
-- Por defecto FALSE = pacientes cerrados (que es lo que pidió el cliente).
CREATE OR REPLACE FUNCTION public.patient_access_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT (value->>'enable_patient_access')::boolean
       FROM public.site_settings WHERE id = 'feature_toggles'),
    false);
$$;
COMMENT ON FUNCTION public.patient_access_enabled() IS
  'true si el registro/acceso de PACIENTES está abierto. Se controla desde Admin → Ajustes del sitio → feature_toggles.enable_patient_access. Por defecto false ("próximamente").';
GRANT EXECUTE ON FUNCTION public.patient_access_enabled() TO anon, authenticated;

-- El candado REAL va en el trigger de alta: aunque alguien llame a la API de
-- Supabase saltándose la web, el alta con rol 'patient' falla en la base.
-- (Se conserva el resto de handle_new_user tal cual estaba.)
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
    _signup_code TEXT;
    _code RECORD;
    _campaign_id uuid := NULL;
BEGIN
    _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'patient');
    IF _role = 'admin' THEN
        _role := 'patient';
    END IF;

    -- ▸ CANDADO DE PACIENTES (2026-08-17). El súper admin puede seguir dando de
    --   alta pacientes a mano marcando admin_created=true en los metadatos.
    IF _role = 'patient'
       AND NOT public.patient_access_enabled()
       AND COALESCE(NEW.raw_user_meta_data->>'admin_created','') <> 'true' THEN
        RAISE EXCEPTION 'PATIENT_SIGNUP_DISABLED'
            USING HINT = 'El acceso para pacientes estará disponible próximamente.';
    END IF;

    -- ▸ CÓDIGO DE CAMPAÑA (opcional). Si viene uno, tiene que ser válido: dar por
    --   bueno un código caducado dejaría a la persona creyendo que tiene la promo.
    _signup_code := UPPER(NULLIF(TRIM(NEW.raw_user_meta_data->>'signup_code'), ''));
    IF _signup_code IS NOT NULL THEN
        SELECT c.id, c.campaign_id, c.status, ca.is_active, ca.starts_at, ca.expires_at, ca.target_role
          INTO _code
          FROM public.signup_codes c
          JOIN public.signup_campaigns ca ON ca.id = c.campaign_id
         WHERE c.code = _signup_code
         FOR UPDATE OF c;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'SIGNUP_CODE_INVALID' USING HINT = 'El código de registro no existe.';
        END IF;
        IF _code.status <> 'available' THEN
            RAISE EXCEPTION 'SIGNUP_CODE_USED' USING HINT = 'Ese código de registro ya se usó.';
        END IF;
        IF NOT _code.is_active
           OR (_code.starts_at  IS NOT NULL AND now() < _code.starts_at)
           OR (_code.expires_at IS NOT NULL AND now() > _code.expires_at) THEN
            RAISE EXCEPTION 'SIGNUP_CODE_EXPIRED' USING HINT = 'Ese código de registro ya no está vigente.';
        END IF;
        IF _code.target_role <> 'any' AND _code.target_role <> _role::text THEN
            RAISE EXCEPTION 'SIGNUP_CODE_WRONG_ROLE' USING HINT = 'Ese código no es para este tipo de cuenta.';
        END IF;
        _campaign_id := _code.campaign_id;
    END IF;

    _name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
    _ced_esp := NULLIF(NEW.raw_user_meta_data->>'cedula_especialidad','');

    INSERT INTO public.profiles (id, email, name, avatar_url, referred_by_doctor_code, signup_code, signup_campaign_id)
    VALUES (
        NEW.id, NEW.email, _name,
        NEW.raw_user_meta_data->>'avatar_url',
        NULLIF(NEW.raw_user_meta_data->>'doctor_code',''),
        _signup_code,
        _campaign_id
    );

    IF _signup_code IS NOT NULL THEN
        UPDATE public.signup_codes
           SET status = 'redeemed', redeemed_by = NEW.id, redeemed_at = now()
         WHERE id = _code.id;
    END IF;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, _role);

    IF _role IN ('patient', 'resident', 'doctor') THEN
        INSERT INTO public.wallets (user_id, balance) VALUES (NEW.id, 0);
    END IF;

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

-- Segundo cerrojo: la política que deja a cada usuario asignarse su propio rol
-- ya no acepta 'patient' mientras el acceso esté cerrado.
DROP POLICY IF EXISTS "Users can insert own non-admin role" ON public.user_roles;
CREATE POLICY "Users can insert own non-admin role" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (
      role IN ('doctor'::public.app_role, 'resident'::public.app_role)
      OR (role = 'patient'::public.app_role AND public.patient_access_enabled())
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) CÓDIGO POR MÉDICO  —  OBS-001, CAR-014, PED-007…
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.specialty_codes (
  specialty text PRIMARY KEY,
  code      text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{3}$')
);
COMMENT ON TABLE public.specialty_codes IS
  'Prefijo de 3 letras por especialidad para el código de médico que ve el súper admin (Ginecología y Obstetricia → OBS).';
ALTER TABLE public.specialty_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read specialty codes" ON public.specialty_codes;
CREATE POLICY "Anyone can read specialty codes" ON public.specialty_codes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage specialty codes" ON public.specialty_codes;
CREATE POLICY "Admins manage specialty codes" ON public.specialty_codes
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

INSERT INTO public.specialty_codes (specialty, code) VALUES
  ('Alergología e Inmunología', 'ALE'),
  ('Algología', 'ALG'),
  ('Anestesiología', 'ANE'),
  ('Anestesiología Pediátrica', 'ANP'),
  ('Angiología, Cirugía Vascular y Endovascular', 'ANG'),
  ('Biología de la Reproducción Humana', 'BIO'),
  ('Broncoscopía Intervencionista', 'BRO'),
  ('Cardiología Clínica', 'CAR'),
  ('Cardiología Intervencionista', 'CAI'),
  ('Cardiología Intervencionista en Cardiopatías Congénitas', 'CIN'),
  ('Cardiología Intervencionista Pediátrica', 'CIP'),
  ('Cardiología Pediátrica', 'CAP'),
  ('Cirugía Bariátrica', 'CIB'),
  ('Cirugía Cardíaca', 'CIC'),
  ('Cirugía Cardíaca Pediátrica', 'CCP'),
  ('Cirugía Cardiotorácica', 'CCA'),
  ('Cirugía de Colon y Recto', 'CCO'),
  ('Cirugía de Tórax', 'CIT'),
  ('Cirugía de Tórax Pediátrica', 'CTP'),
  ('Cirugía de Trasplantes', 'CTR'),
  ('Cirugía del Aparato Digestivo', 'CIA'),
  ('Cirugía General', 'CIR'),
  ('Cirugía Maxilofacial', 'CIM'),
  ('Cirugía Oncológica', 'CIO'),
  ('Cirugía Oncológica Pediátrica', 'COP'),
  ('Cirugía Pediátrica', 'CGP'),
  ('Cirugía Plástica, Estética y Reconstructiva', 'CPL'),
  ('Cirugía Torácica No Cardiaca', 'CTO'),
  ('Coloproctología', 'COL'),
  ('Comunicación, Audiología, Otoneurología y Foniatría', 'COM'),
  ('Cuidados Paliativos', 'PAL'),
  ('Dermatología', 'DER'),
  ('Dermatología Pediátrica', 'DEP'),
  ('Ecocardiografía Adultos', 'ECO'),
  ('Ecocardiografía Pediátrica', 'ECP'),
  ('Electrofisiología', 'ELE'),
  ('Endocrinología', 'END'),
  ('Endocrinología Pediátrica', 'ENP'),
  ('Endoscopía', 'EN2'),
  ('Endoscopia Gastrointestinal', 'ENG'),
  ('Endoscopía Torácica', 'ENT'),
  ('Gastroenterología', 'GAS'),
  ('Gastroenterología Pediátrica', 'GAP'),
  ('Genética Médica', 'GEN'),
  ('Geriatría', 'GER'),
  ('Ginecología Oncológica', 'GIN'),
  ('Ginecología y Obstetricia', 'OBS'),
  ('Hematología', 'HEM'),
  ('Hematología Pediátrica', 'HEP'),
  ('Imagen de la Mama', 'IMA'),
  ('Imagen del Sistema Musculoesquelético', 'IMS'),
  ('Infectología', 'INF'),
  ('Infectología Pediátrica', 'INP'),
  ('Medicina Crítica', 'MCR'),
  ('Medicina de Rehabilitación', 'MER'),
  ('Medicina del Enfermo Pediátrico Cardiovascular en Estado Crítico', 'MEP'),
  ('Medicina del Enfermo Pediátrico en Estado Crítico', 'MEE'),
  ('Medicina del Sueño', 'SUE'),
  ('Medicina General', 'MED'),
  ('Medicina Interna', 'MIN'),
  ('Medicina Materna Fetal', 'MMF'),
  ('Medicina Nuclear', 'MEN'),
  ('Medicina Nuclear Cardiológica', 'MNU'),
  ('Medicina Nuclear Oncológica Molecular y Terapéutica', 'MNT'),
  ('Médico Cirujano', 'MCJ'),
  ('Nefrología', 'NEF'),
  ('Nefrología Pediátrica', 'NFP'),
  ('Neonatología', 'NEO'),
  ('Neumología', 'NML'),
  ('Neumología Pediátrica', 'NPE'),
  ('Neuroanestesiología', 'NE2'),
  ('Neurocirugía', 'NCR'),
  ('Neurocirugía Pediátrica', 'NCP'),
  ('Neurofisiología Clínica', 'NEC'),
  ('Neurolingüística', 'NE3'),
  ('Neurología', 'NEU'),
  ('Neurología Pediátrica', 'NEP'),
  ('Neurootología', 'NE4'),
  ('Neurorradiología', 'NE5'),
  ('Nutrición Clínica', 'NUC'),
  ('Nutrición de Alimentos', 'NUA'),
  ('Nutrición y Ciencias de los Alimentos', 'NCI'),
  ('Nutrición', 'NUT'),
  ('Odontología', 'ODO'),
  ('Odontología Pediátrica', 'ODP'),
  ('Oftalmología', 'OFT'),
  ('Oncología Médica', 'ONC'),
  ('Oncología Pediátrica', 'ONP'),
  ('Ortopedia y Traumatología', 'ORT'),
  ('Otorrinolaringología Pediátrica', 'OTP'),
  ('Otorrinolaringología y Cirugía de Cabeza y Cuello', 'ORL'),
  ('Patología Clínica', 'PAT'),
  ('Patología Quirúrgica', 'PAQ'),
  ('Pediatría', 'PED'),
  ('Proctología', 'PRO'),
  ('Psicología', 'PSI'),
  ('Psiquiatría Adultos', 'PSQ'),
  ('Psiquiatría Infantil y de la Adolescencia', 'PIN'),
  ('Radio-Oncología', 'RAO'),
  ('Radiología e Imagen', 'RAD'),
  ('Radiología Vascular e Intervencionista', 'RAV'),
  ('Rehabilitación Cardíaca y Prevención Secundaria', 'REH'),
  ('Rehabilitación Oncológica', 'REO'),
  ('Reumatología', 'REU'),
  ('Reumatología Pediátrica', 'REP'),
  ('Terapia Endovascular Neurológica', 'TER'),
  ('Terapia Física y Rehabilitación', 'TEF'),
  ('Urgencias', 'URG'),
  ('Urgencias Pediátricas', 'URP'),
  ('Urología', 'URO'),
  ('Urología Ginecológica', 'UGI'),
  ('Otra especialidad', 'OTR')
ON CONFLICT (specialty) DO NOTHING;

ALTER TABLE public.doctor_profiles
  ADD COLUMN IF NOT EXISTS doctor_code      text,
  ADD COLUMN IF NOT EXISTS doctor_number    integer,
  ADD COLUMN IF NOT EXISTS specialty_number integer;

COMMENT ON COLUMN public.doctor_profiles.doctor_code IS
  'Identificador legible: prefijo de especialidad + correlativo dentro de esa especialidad (OBS-001). Sólo lo ve el súper admin.';
COMMENT ON COLUMN public.doctor_profiles.doctor_number IS
  'Correlativo GLOBAL de alta (1, 2, 3…). Es el "del 1 al 50" de las campañas.';

CREATE UNIQUE INDEX IF NOT EXISTS doctor_profiles_doctor_code_uidx
  ON public.doctor_profiles (doctor_code) WHERE doctor_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS doctor_profiles_doctor_number_uidx
  ON public.doctor_profiles (doctor_number) WHERE doctor_number IS NOT NULL;

-- Quita acentos sin depender de la extensión unaccent (que no está instalada).
CREATE OR REPLACE FUNCTION public.unaccent_safe(_t text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT translate(COALESCE(_t,''),
    'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
    'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC');
$$;

-- Prefijo de una especialidad. Si no está en la tabla (especialidades sueltas
-- que el admin añade en extra_specialties), se deriva de las 3 primeras letras
-- sin acentos; si ni eso, 'OTR'.
CREATE OR REPLACE FUNCTION public.mm_specialty_code(_specialty text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _c text; _clean text;
BEGIN
  IF _specialty IS NULL OR btrim(_specialty) = '' THEN RETURN 'OTR'; END IF;
  SELECT code INTO _c FROM public.specialty_codes WHERE specialty = _specialty;
  IF _c IS NOT NULL THEN RETURN _c; END IF;
  SELECT code INTO _c FROM public.specialty_codes
   WHERE lower(unaccent_safe(specialty)) = lower(unaccent_safe(_specialty)) LIMIT 1;
  IF _c IS NOT NULL THEN RETURN _c; END IF;
  _clean := upper(regexp_replace(unaccent_safe(_specialty), '[^A-Za-z]', '', 'g'));
  IF length(_clean) >= 3 THEN RETURN substr(_clean, 1, 3); END IF;
  RETURN 'OTR';
END;
$$;

-- Asigna código + números. Se dispara al ALTA y también cuando el médico
-- completa el onboarding y por fin se sabe su especialidad de verdad (hasta ese
-- momento doctor_profiles nace con 'General' y el código sería inútil).
CREATE OR REPLACE FUNCTION public.assign_doctor_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _prefix text; _n integer; _g integer;
BEGIN
  IF NEW.doctor_code IS NOT NULL THEN RETURN NEW; END IF;

  -- Un solo asignador a la vez: dos altas simultáneas no pueden llevarse el mismo número.
  PERFORM pg_advisory_xact_lock(hashtext('mm_doctor_code'));

  _prefix := public.mm_specialty_code(NEW.specialty);

  SELECT COALESCE(MAX(specialty_number), 0) + 1 INTO _n
    FROM public.doctor_profiles WHERE doctor_code LIKE _prefix || '-%';

  SELECT COALESCE(MAX(doctor_number), 0) + 1 INTO _g FROM public.doctor_profiles;

  NEW.specialty_number := _n;
  NEW.doctor_number    := COALESCE(NEW.doctor_number, _g);
  NEW.doctor_code      := _prefix || '-' || lpad(_n::text, 3, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_doctor_code_ins ON public.doctor_profiles;
CREATE TRIGGER trg_assign_doctor_code_ins
  BEFORE INSERT ON public.doctor_profiles
  FOR EACH ROW EXECUTE FUNCTION public.assign_doctor_code();

DROP TRIGGER IF EXISTS trg_assign_doctor_code_upd ON public.doctor_profiles;
CREATE TRIGGER trg_assign_doctor_code_upd
  BEFORE UPDATE OF specialty ON public.doctor_profiles
  FOR EACH ROW WHEN (NEW.doctor_code IS NULL)
  EXECUTE FUNCTION public.assign_doctor_code();

-- Relleno de los médicos que ya estaban dados de alta, por orden de antigüedad.
DO $$
DECLARE r RECORD; _prefix text; _n integer; _g integer := 0;
BEGIN
  FOR r IN SELECT id, specialty FROM public.doctor_profiles
            WHERE doctor_code IS NULL ORDER BY created_at, id LOOP
    _prefix := public.mm_specialty_code(r.specialty);
    SELECT COALESCE(MAX(specialty_number), 0) + 1 INTO _n
      FROM public.doctor_profiles WHERE doctor_code LIKE _prefix || '-%';
    SELECT COALESCE(MAX(doctor_number), 0) + 1 INTO _g FROM public.doctor_profiles;
    UPDATE public.doctor_profiles
       SET doctor_code = _prefix || '-' || lpad(_n::text, 3, '0'),
           specialty_number = _n,
           doctor_number = COALESCE(doctor_number, _g)
     WHERE id = r.id;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) CAMPAÑAS DE REGISTRO  —  códigos de 50 en 50 / 100 en 100
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.signup_campaigns (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  prefix        text NOT NULL CHECK (prefix ~ '^[A-Z0-9]{2,10}$'),
  target_role   text NOT NULL DEFAULT 'doctor' CHECK (target_role IN ('doctor','resident','any')),
  price_cents   integer CHECK (price_cents IS NULL OR price_cents >= 0),
  currency      text NOT NULL DEFAULT 'mxn',
  discount_percentage numeric CHECK (discount_percentage IS NULL OR (discount_percentage >= 0 AND discount_percentage <= 100)),
  notes         text,
  starts_at     timestamptz,
  expires_at    timestamptz,
  is_active     boolean NOT NULL DEFAULT true,
  created_by    uuid REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.signup_campaigns IS
  'Campañas de captación: "primeros 50 médicos a precio X". El súper admin genera los códigos y los reparte.';

CREATE TABLE IF NOT EXISTS public.signup_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.signup_campaigns(id) ON DELETE CASCADE,
  code        text NOT NULL UNIQUE,
  seq         integer NOT NULL,
  status      text NOT NULL DEFAULT 'available' CHECK (status IN ('available','redeemed','revoked')),
  redeemed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  redeemed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, seq)
);
CREATE INDEX IF NOT EXISTS signup_codes_campaign_idx ON public.signup_codes (campaign_id, seq);
CREATE INDEX IF NOT EXISTS signup_codes_status_idx   ON public.signup_codes (status);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signup_code        text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signup_campaign_id uuid REFERENCES public.signup_campaigns(id) ON DELETE SET NULL;

ALTER TABLE public.signup_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signup_codes     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage signup campaigns" ON public.signup_campaigns;
CREATE POLICY "Admins manage signup campaigns" ON public.signup_campaigns
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

-- Los códigos NO son legibles por nadie más que el admin: si cualquiera pudiera
-- listarlos, se acabó la campaña. La validación pública va por RPC (abajo).
DROP POLICY IF EXISTS "Admins manage signup codes" ON public.signup_codes;
CREATE POLICY "Admins manage signup codes" ON public.signup_codes
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

-- Generador de códigos (lo llama el panel del súper admin).
CREATE OR REPLACE FUNCTION public.generate_signup_codes(_campaign_id uuid, _count integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _prefix text; _next integer; _made integer := 0; _try text; _i integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF _count IS NULL OR _count < 1 OR _count > 1000 THEN
    RAISE EXCEPTION 'COUNT_OUT_OF_RANGE' USING HINT = 'Entre 1 y 1000 códigos por tanda.';
  END IF;

  SELECT prefix INTO _prefix FROM public.signup_campaigns WHERE id = _campaign_id;
  IF _prefix IS NULL THEN RAISE EXCEPTION 'CAMPAIGN_NOT_FOUND'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('mm_signup_codes:' || _campaign_id::text));
  SELECT COALESCE(MAX(seq), 0) + 1 INTO _next FROM public.signup_codes WHERE campaign_id = _campaign_id;

  FOR _i IN 0.._count - 1 LOOP
    -- Sufijo aleatorio sin caracteres ambiguos (0/O, 1/I) — estos códigos se
    -- dictan por teléfono y se teclean a mano.
    LOOP
      SELECT _prefix || '-' || lpad((_next + _i)::text, 3, '0') || '-' ||
             string_agg(substr('ACDEFGHJKLMNPQRTUVWXY34679', floor(random() * 26)::int + 1, 1), '')
        INTO _try
        FROM generate_series(1, 4);
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.signup_codes WHERE code = _try);
    END LOOP;
    INSERT INTO public.signup_codes (campaign_id, code, seq) VALUES (_campaign_id, _try, _next + _i);
    _made := _made + 1;
  END LOOP;

  RETURN _made;
END;
$$;
REVOKE ALL ON FUNCTION public.generate_signup_codes(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_signup_codes(uuid, integer) TO authenticated;

-- Validación pública: dice si un código sirve, SIN dejar listar ni adivinar nada.
CREATE OR REPLACE FUNCTION public.validate_signup_code(_code text)
RETURNS TABLE (valid boolean, reason text, campaign_name text, target_role text, price_cents integer, currency text, discount_percentage numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE r RECORD;
BEGIN
  SELECT c.status, ca.name, ca.target_role, ca.price_cents, ca.currency, ca.discount_percentage,
         ca.is_active, ca.starts_at, ca.expires_at
    INTO r
    FROM public.signup_codes c JOIN public.signup_campaigns ca ON ca.id = c.campaign_id
   WHERE c.code = upper(btrim(_code));

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'not_found', NULL::text, NULL::text, NULL::integer, NULL::text, NULL::numeric; RETURN;
  END IF;
  IF r.status <> 'available' THEN
    RETURN QUERY SELECT false, 'used', r.name, r.target_role, r.price_cents, r.currency, r.discount_percentage; RETURN;
  END IF;
  IF NOT r.is_active
     OR (r.starts_at  IS NOT NULL AND now() < r.starts_at)
     OR (r.expires_at IS NOT NULL AND now() > r.expires_at) THEN
    RETURN QUERY SELECT false, 'expired', r.name, r.target_role, r.price_cents, r.currency, r.discount_percentage; RETURN;
  END IF;
  RETURN QUERY SELECT true, 'ok', r.name, r.target_role, r.price_cents, r.currency, r.discount_percentage;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_signup_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_signup_code(text) TO anon, authenticated;
