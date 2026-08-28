-- ════════════════════════════════════════════════════════════════════════════
-- 2026-08-28 · Peticiones del cliente (Marta / el doctor) en una sola migración
--
--   1) LIVES POR ROL con interruptor: el súper admin decide QUIÉN puede hacer
--      live (médicos / residentes / pacientes) desde Ajustes del sitio, sin
--      desplegar nada. Hoy: médicos SÍ, residentes NO (hasta que lo confirmen).
--   2) EL CONTENIDO NO SE BORRA cuando alguien se da de baja: publicaciones,
--      lives y grabaciones se quedan en la base (términos y condiciones).
--   3) TRES CATEGORÍAS DE PERFIL con distintivo (⭐ estrella · 🟣 punto morado ·
--      🟢 punto verde), visibles en el perfil Y en el contenido.
--   4) RESEÑAS CON ESTRELLAS de contenido y lives, con la matriz de quién puede
--      puntuar a quién (los residentes NO puntúan a pacientes).
--   5) BLOQUEO DE VPN falsas en el registro (apagado por defecto).
--
-- Todo es ADITIVO e idempotente: no borra ni renombra nada existente.
-- ════════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- 0) Ayudante: leer un interruptor de site_settings/feature_toggles
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.mm_toggle(_key text, _default boolean DEFAULT false)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT (value->>_key)::boolean FROM public.site_settings WHERE id = 'feature_toggles'),
    _default);
$$;
COMMENT ON FUNCTION public.mm_toggle(text, boolean) IS
  'Lee un interruptor de Admin → Ajustes del sitio (site_settings/feature_toggles). Si no está guardado, devuelve el valor por defecto que se le pase.';
GRANT EXECUTE ON FUNCTION public.mm_toggle(text, boolean) TO anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 1) QUIÉN PUEDE HACER LIVE  —  un interruptor por rol
-- ═══════════════════════════════════════════════════════════════════════════
-- El cliente cambió de idea sobre los lives de residentes. En vez de tocar
-- código cada vez, el permiso vive en un interruptor: Admin → Ajustes del sitio.
--   feature_toggles.enable_lives_doctors    (por defecto TRUE  — como hoy)
--   feature_toggles.enable_lives_residents  (por defecto FALSE — como hoy)
--   feature_toggles.enable_lives_patients   (por defecto FALSE)
CREATE OR REPLACE FUNCTION public.lives_role_enabled(_role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE _role
    WHEN 'doctor'::public.app_role   THEN public.mm_toggle('enable_lives_doctors',   true)
    WHEN 'resident'::public.app_role THEN public.mm_toggle('enable_lives_residents', false)
    WHEN 'patient'::public.app_role  THEN public.mm_toggle('enable_lives_patients',  false)
    ELSE false
  END;
$$;
COMMENT ON FUNCTION public.lives_role_enabled(public.app_role) IS
  'true si ese rol tiene permitido emitir lives ahora mismo. Se controla desde Admin → Ajustes del sitio (enable_lives_doctors / enable_lives_residents / enable_lives_patients).';
GRANT EXECUTE ON FUNCTION public.lives_role_enabled(public.app_role) TO anon, authenticated;

-- Reescribimos las políticas de alta de lives. Dos cambios:
--   a) respetan el interruptor por rol;
--   b) exigen que el live sea SUYO (doctor_id = auth.uid()). Sin esto, un médico
--      aprobado podía crear un live a nombre de otro — la política vieja sólo
--      comprobaba quién insertaba, no de quién era el live.
DROP POLICY IF EXISTS "Approved doctors can create lives"   ON public.lives;
DROP POLICY IF EXISTS "Approved residents can create lives" ON public.lives;
DROP POLICY IF EXISTS "Approved patients can create lives"  ON public.lives;

CREATE POLICY "Approved doctors can create lives" ON public.lives
  FOR INSERT TO authenticated
  WITH CHECK (
    doctor_id = (SELECT auth.uid())
    AND public.is_approved_doctor((SELECT auth.uid()))
    AND public.lives_role_enabled('doctor'::public.app_role)
  );

CREATE POLICY "Approved residents can create lives" ON public.lives
  FOR INSERT TO authenticated
  WITH CHECK (
    doctor_id = (SELECT auth.uid())
    AND public.is_approved_resident((SELECT auth.uid()))
    AND public.lives_role_enabled('resident'::public.app_role)
  );

-- Pacientes: la política existe pero está cerrada por partida doble (su propio
-- interruptor + el candado global de acceso de pacientes). Así, si mañana lo
-- piden, es un switch y no una migración.
CREATE POLICY "Approved patients can create lives" ON public.lives
  FOR INSERT TO authenticated
  WITH CHECK (
    doctor_id = (SELECT auth.uid())
    AND public.has_role((SELECT auth.uid()), 'patient'::public.app_role)
    AND public.patient_access_enabled()
    AND public.lives_role_enabled('patient'::public.app_role)
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- 2) EL CONTENIDO SOBREVIVE A LA BAJA DE LA CUENTA
-- ═══════════════════════════════════════════════════════════════════════════
-- PROBLEMA REAL ENCONTRADO: lives.doctor_id, doctor_content.creator_id y
-- recordings.doctor_id apuntaban a auth.users con ON DELETE CASCADE. Al borrar
-- la cuenta, la base BORRABA en cascada todos sus lives, grabaciones y
-- publicaciones — justo lo contrario de lo que dicen los términos.
--
-- Solución: un registro permanente de autores (content_authors). El contenido
-- pasa a colgar de ahí, no de auth.users. Cuando alguien se da de baja se
-- borran sus datos personales (LFPDPPP) pero su ficha de autor se queda marcada
-- como "dado de baja" y el contenido sigue en pie.
CREATE TABLE IF NOT EXISTS public.content_authors (
  user_id         uuid PRIMARY KEY,
  display_name    text NOT NULL DEFAULT 'Autor dado de baja',
  role            public.app_role,
  doctor_code     text,
  account_deleted boolean NOT NULL DEFAULT false,
  deleted_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.content_authors IS
  'Registro PERMANENTE de autores. Sobrevive a la baja de la cuenta para que el contenido publicado y los lives no se borren (términos y condiciones, cliente 2026-08-28). Sólo el admin ve el nombre real de quien se dio de baja.';

CREATE INDEX IF NOT EXISTS content_authors_deleted_idx ON public.content_authors (account_deleted);

-- Relleno con todo el mundo que ya existe.
INSERT INTO public.content_authors (user_id, display_name, role, doctor_code)
SELECT p.id,
       COALESCE(NULLIF(btrim(p.name), ''), 'Autor'),
       (SELECT ur.role FROM public.user_roles ur WHERE ur.user_id = p.id LIMIT 1),
       (SELECT dp.doctor_code FROM public.doctor_profiles dp WHERE dp.user_id = p.id LIMIT 1)
FROM public.profiles p
ON CONFLICT (user_id) DO NOTHING;

-- Se mantiene al día solo: cada alta o cambio de nombre en profiles se refleja aquí.
CREATE OR REPLACE FUNCTION public.sync_content_author()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.content_authors (user_id, display_name, role, doctor_code)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(btrim(NEW.name), ''), 'Autor'),
    (SELECT ur.role FROM public.user_roles ur WHERE ur.user_id = NEW.id LIMIT 1),
    (SELECT dp.doctor_code FROM public.doctor_profiles dp WHERE dp.user_id = NEW.id LIMIT 1)
  )
  ON CONFLICT (user_id) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        role         = COALESCE(EXCLUDED.role, public.content_authors.role),
        doctor_code  = COALESCE(EXCLUDED.doctor_code, public.content_authors.doctor_code),
        updated_at   = now()
    WHERE public.content_authors.account_deleted = false;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_content_author ON public.profiles;
CREATE TRIGGER trg_sync_content_author
  AFTER INSERT OR UPDATE OF name ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_content_author();

-- Al borrar el perfil (baja de la cuenta) marcamos la ficha de autor y BORRAMOS
-- el nombre real: el contenido se queda, la persona no.
CREATE OR REPLACE FUNCTION public.tombstone_content_author()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.content_authors
     SET account_deleted = true,
         deleted_at      = COALESCE(deleted_at, now()),
         display_name    = 'Autor dado de baja',
         updated_at      = now()
   WHERE user_id = OLD.id;
  IF NOT FOUND THEN
    INSERT INTO public.content_authors (user_id, display_name, account_deleted, deleted_at)
    VALUES (OLD.id, 'Autor dado de baja', true, now())
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_tombstone_content_author ON public.profiles;
CREATE TRIGGER trg_tombstone_content_author
  BEFORE DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tombstone_content_author();

-- ▸ El cambio que de verdad salva el contenido: quitar el CASCADE a auth.users
--   y colgar el contenido del registro permanente.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname, c.conrelid::regclass::text AS tbl, a.attname AS col
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f'
       AND c.confrelid = 'auth.users'::regclass
       AND c.conrelid IN ('public.lives'::regclass,
                          'public.doctor_content'::regclass,
                          'public.recordings'::regclass)
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
    RAISE NOTICE 'FK en cascada retirada: %.% (%)', r.tbl, r.col, r.conname;
  END LOOP;
END $$;

-- Cualquier autor que aún no estuviera fichado (contenido antiguo huérfano).
INSERT INTO public.content_authors (user_id, display_name, account_deleted, deleted_at)
SELECT DISTINCT x.uid, 'Autor dado de baja', true, now()
  FROM (
    SELECT doctor_id  AS uid FROM public.lives
    UNION SELECT creator_id FROM public.doctor_content
    UNION SELECT doctor_id  FROM public.recordings
  ) x
 WHERE x.uid IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.content_authors ca WHERE ca.user_id = x.uid)
ON CONFLICT (user_id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lives_author_fk') THEN
    ALTER TABLE public.lives ADD CONSTRAINT lives_author_fk
      FOREIGN KEY (doctor_id) REFERENCES public.content_authors(user_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'doctor_content_author_fk') THEN
    ALTER TABLE public.doctor_content ADD CONSTRAINT doctor_content_author_fk
      FOREIGN KEY (creator_id) REFERENCES public.content_authors(user_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recordings_author_fk') THEN
    ALTER TABLE public.recordings ADD CONSTRAINT recordings_author_fk
      FOREIGN KEY (doctor_id) REFERENCES public.content_authors(user_id) ON DELETE RESTRICT;
  END IF;
END $$;

ALTER TABLE public.content_authors ENABLE ROW LEVEL SECURITY;

-- Todo el mundo puede leer la ficha pública de autor (es lo que pinta el nombre
-- bajo un live o un contenido). El nombre real de quien se dio de baja ya no
-- está ahí: se sustituyó por "Autor dado de baja".
DROP POLICY IF EXISTS "Anyone can read content authors" ON public.content_authors;
CREATE POLICY "Anyone can read content authors" ON public.content_authors
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage content authors" ON public.content_authors;
CREATE POLICY "Admins manage content authors" ON public.content_authors
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

-- profiles_public suma ahora a los autores dados de baja, así que TODA consulta
-- que ya pintaba el nombre del autor sigue funcionando sin tocar una línea.
CREATE OR REPLACE VIEW public.profiles_public
  WITH (security_invoker = true) AS
  SELECT id, name, avatar_url, is_identity_verified, created_at, updated_at
    FROM public.profiles
  UNION ALL
  SELECT ca.user_id, ca.display_name, NULL::text, false, ca.created_at, ca.updated_at
    FROM public.content_authors ca
   WHERE ca.account_deleted = true
     AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = ca.user_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- 3) TRES CATEGORÍAS DE PERFIL CON DISTINTIVO
-- ═══════════════════════════════════════════════════════════════════════════
-- Petición literal del doctor (audio 2026-08-28): tres categorías de perfil,
-- cada una con su distintivo — una estrella, un punto morado y un punto verde —
-- visibles en el perfil del médico Y en el contenido, para saber de un vistazo
-- qué tipo de perfil lo publicó.
--
-- El NOMBRE de cada categoría lo pone el cliente desde el panel: aquí no se
-- inventa ninguno. Los distintivos sí son los tres que pidió.
CREATE TABLE IF NOT EXISTS public.profile_categories (
  key          text PRIMARY KEY,
  display_name text NOT NULL,
  mark         text NOT NULL CHECK (mark IN ('star','purple_dot','green_dot')),
  description  text,
  sort_order   integer NOT NULL DEFAULT 0,
  is_active    boolean NOT NULL DEFAULT true,
  updated_at   timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.profile_categories IS
  'Las 3 categorías de perfil del cliente (2026-08-28). El distintivo es fijo (estrella / punto morado / punto verde); el nombre lo edita el admin en Ajustes del sitio.';

INSERT INTO public.profile_categories (key, display_name, mark, sort_order) VALUES
  ('cat_star',   'Categoría 1', 'star',       1),
  ('cat_purple', 'Categoría 2', 'purple_dot', 2),
  ('cat_green',  'Categoría 3', 'green_dot',  3)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.profile_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read profile categories" ON public.profile_categories;
CREATE POLICY "Anyone can read profile categories" ON public.profile_categories
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage profile categories" ON public.profile_categories;
CREATE POLICY "Admins manage profile categories" ON public.profile_categories
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

-- La categoría vive en profiles (no en doctor_profiles) porque el contenido lo
-- publican médicos Y residentes: así el distintivo funciona para los dos.
ALTER TABLE public.profiles          ADD COLUMN IF NOT EXISTS profile_category text;
ALTER TABLE public.content_authors   ADD COLUMN IF NOT EXISTS profile_category text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_profile_category_fk') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_profile_category_fk
      FOREIGN KEY (profile_category) REFERENCES public.profile_categories(key) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.profile_category IS
  'Categoría de perfil asignada por el admin (profile_categories.key). Pinta el distintivo en el perfil y en el contenido.';

-- Sólo el admin cambia la categoría de alguien.
CREATE OR REPLACE FUNCTION public.guard_profile_category()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- auth.uid() es NULL cuando escribe la service_role o un script del admin por
  -- psql: ahí no hay a quién comprobar y la operación ya es de confianza.
  IF NEW.profile_category IS DISTINCT FROM OLD.profile_category
     AND auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'PROFILE_CATEGORY_ADMIN_ONLY'
      USING HINT = 'Sólo el administrador puede cambiar la categoría de un perfil.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_category ON public.profiles;
CREATE TRIGGER trg_guard_profile_category
  BEFORE UPDATE OF profile_category ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_category();

-- La categoría también se copia al registro permanente de autores, para que el
-- contenido de alguien que se dio de baja siga mostrando su distintivo.
CREATE OR REPLACE FUNCTION public.sync_content_author()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.content_authors (user_id, display_name, role, doctor_code, profile_category)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(btrim(NEW.name), ''), 'Autor'),
    (SELECT ur.role FROM public.user_roles ur WHERE ur.user_id = NEW.id LIMIT 1),
    (SELECT dp.doctor_code FROM public.doctor_profiles dp WHERE dp.user_id = NEW.id LIMIT 1),
    NEW.profile_category
  )
  ON CONFLICT (user_id) DO UPDATE
    SET display_name     = EXCLUDED.display_name,
        role             = COALESCE(EXCLUDED.role, public.content_authors.role),
        doctor_code      = COALESCE(EXCLUDED.doctor_code, public.content_authors.doctor_code),
        profile_category = EXCLUDED.profile_category,
        updated_at       = now()
    WHERE public.content_authors.account_deleted = false;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_content_author ON public.profiles;
CREATE TRIGGER trg_sync_content_author
  AFTER INSERT OR UPDATE OF name, profile_category ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_content_author();

-- Lectura en lote (1 llamada para una lista entera, como get_doctor_badges).
-- Devuelve además el ROL, que es lo que distingue "médico" de "residente" en la
-- parrilla de lives y en el contenido.
CREATE OR REPLACE FUNCTION public.get_profile_categories(p_user_ids uuid[])
RETURNS TABLE (user_id uuid, category_key text, display_name text, mark text, author_role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT ca.user_id,
         pc.key,
         pc.display_name,
         pc.mark,
         ca.role::text
    FROM public.content_authors ca
    LEFT JOIN public.profile_categories pc
           ON pc.key = ca.profile_category AND pc.is_active
   WHERE ca.user_id = ANY(p_user_ids);
$$;
REVOKE ALL ON FUNCTION public.get_profile_categories(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_categories(uuid[]) TO anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 4) RESEÑAS CON ESTRELLAS DE CONTENIDO Y LIVES
-- ═══════════════════════════════════════════════════════════════════════════
-- Matriz que pidió el cliente (2026-08-28):
--     Paciente → Residente  ✅      Médico   → Paciente  ✅
--     Paciente → Médico     ✅      Médico   → Residente ✅
--     Residente → Médico    ✅      Residente → Paciente ❌
-- Regla en una línea: puntúa todo el mundo, MENOS un residente a un paciente.
-- Y nadie se puntúa a sí mismo.
CREATE OR REPLACE FUNCTION public.can_rate_user(_rater uuid, _owner uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _rater IS NOT NULL
     AND _owner IS NOT NULL
     AND _rater <> _owner
     AND NOT (public.has_role(_rater, 'resident'::public.app_role)
              AND public.has_role(_owner, 'patient'::public.app_role));
$$;
COMMENT ON FUNCTION public.can_rate_user(uuid, uuid) IS
  'Matriz de reseñas del cliente (2026-08-28): puede puntuar todo el mundo menos un residente a un paciente, y nadie a sí mismo.';
GRANT EXECUTE ON FUNCTION public.can_rate_user(uuid, uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.content_ratings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type    text NOT NULL CHECK (target_type IN ('content','live','recording')),
  target_id      uuid NOT NULL,
  target_owner_id uuid NOT NULL,
  rater_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating         integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment        text CHECK (comment IS NULL OR length(comment) <= 2000),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (target_type, target_id, rater_id)
);
COMMENT ON TABLE public.content_ratings IS
  'Reseñas con estrellas de contenido publicado, lives y grabaciones (cliente 2026-08-28). Una por persona y pieza; se puede editar.';

CREATE INDEX IF NOT EXISTS content_ratings_target_idx ON public.content_ratings (target_type, target_id);
CREATE INDEX IF NOT EXISTS content_ratings_owner_idx  ON public.content_ratings (target_owner_id);

-- El dueño de la pieza NO se manda desde el navegador: lo resuelve la base.
-- Si viniera del cliente, cualquiera podría reseñar "a nombre de" otro autor.
CREATE OR REPLACE FUNCTION public.resolve_rating_target()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _owner uuid; _public boolean := true;
BEGIN
  IF NEW.target_type = 'content' THEN
    SELECT creator_id,
           (is_public AND moderation_status = 'approved'::public.content_moderation_status)
      INTO _owner, _public
      FROM public.doctor_content WHERE id = NEW.target_id;
  ELSIF NEW.target_type = 'live' THEN
    SELECT doctor_id, true INTO _owner, _public FROM public.lives WHERE id = NEW.target_id;
  ELSE
    SELECT doctor_id, true INTO _owner, _public FROM public.recordings WHERE id = NEW.target_id;
  END IF;

  IF _owner IS NULL THEN
    RAISE EXCEPTION 'RATING_TARGET_NOT_FOUND' USING HINT = 'Esa publicación o live no existe.';
  END IF;
  IF NOT _public THEN
    RAISE EXCEPTION 'RATING_TARGET_NOT_PUBLIC' USING HINT = 'Sólo se puede reseñar contenido público.';
  END IF;
  IF NOT public.can_rate_user(NEW.rater_id, _owner) THEN
    RAISE EXCEPTION 'RATING_NOT_ALLOWED' USING HINT = 'Tu tipo de cuenta no puede reseñar a este autor.';
  END IF;

  NEW.target_owner_id := _owner;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_resolve_rating_target ON public.content_ratings;
CREATE TRIGGER trg_resolve_rating_target
  BEFORE INSERT OR UPDATE ON public.content_ratings
  FOR EACH ROW EXECUTE FUNCTION public.resolve_rating_target();

ALTER TABLE public.content_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ratings are readable by everyone" ON public.content_ratings;
CREATE POLICY "Ratings are readable by everyone" ON public.content_ratings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users rate within the allowed matrix" ON public.content_ratings;
CREATE POLICY "Users rate within the allowed matrix" ON public.content_ratings
  FOR INSERT TO authenticated
  WITH CHECK (rater_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users update own rating" ON public.content_ratings;
CREATE POLICY "Users update own rating" ON public.content_ratings
  FOR UPDATE TO authenticated
  USING (rater_id = (SELECT auth.uid()))
  WITH CHECK (rater_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users delete own rating" ON public.content_ratings;
CREATE POLICY "Users delete own rating" ON public.content_ratings
  FOR DELETE TO authenticated
  USING (rater_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

-- Media y número de reseñas de una lista de piezas, en una sola llamada.
CREATE OR REPLACE FUNCTION public.get_ratings_summary(p_target_type text, p_target_ids uuid[])
RETURNS TABLE (target_id uuid, avg_rating numeric, ratings_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT r.target_id,
         round(avg(r.rating)::numeric, 2),
         count(*)::integer
    FROM public.content_ratings r
   WHERE r.target_type = p_target_type
     AND r.target_id = ANY(p_target_ids)
   GROUP BY r.target_id;
$$;
REVOKE ALL ON FUNCTION public.get_ratings_summary(text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ratings_summary(text, uuid[]) TO anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 5) VPN FALSAS EN EL REGISTRO
-- ═══════════════════════════════════════════════════════════════════════════
-- Se guarda SIEMPRE el veredicto de cada intento (para poder mirarlo antes de
-- cerrar la puerta a nadie) y se bloquea sólo si el admin enciende el
-- interruptor feature_toggles.block_vpn_signup. Por defecto: APAGADO.
CREATE TABLE IF NOT EXISTS public.ip_reputation_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip          inet,
  email       text,
  action      text NOT NULL CHECK (action IN ('signup','login','check')),
  is_vpn      boolean,
  is_proxy    boolean,
  is_hosting  boolean,
  is_tor      boolean,
  country     text,
  asn         text,
  org         text,
  verdict     text NOT NULL CHECK (verdict IN ('allow','flag','block')),
  provider    text,
  raw         jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.ip_reputation_log IS
  'Veredicto de VPN/proxy/datacenter en cada registro o login (cliente 2026-08-28). Se registra siempre; sólo bloquea si feature_toggles.block_vpn_signup está encendido.';

CREATE INDEX IF NOT EXISTS ip_reputation_log_ip_idx      ON public.ip_reputation_log (ip);
CREATE INDEX IF NOT EXISTS ip_reputation_log_created_idx ON public.ip_reputation_log (created_at DESC);
CREATE INDEX IF NOT EXISTS ip_reputation_log_verdict_idx ON public.ip_reputation_log (verdict);

ALTER TABLE public.ip_reputation_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read ip reputation" ON public.ip_reputation_log;
CREATE POLICY "Admins read ip reputation" ON public.ip_reputation_log
  FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));
-- La escritura la hace la edge function con service_role, que se salta RLS.

-- Lista blanca: IPs y países que nunca se bloquean aunque el detector se ponga
-- nervioso (la oficina del cliente, un hospital con salida por proxy…).
CREATE TABLE IF NOT EXISTS public.ip_allowlist (
  ip         inet PRIMARY KEY,
  note       text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ip_allowlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage ip allowlist" ON public.ip_allowlist;
CREATE POLICY "Admins manage ip allowlist" ON public.ip_allowlist
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));


-- ═══════════════════════════════════════════════════════════════════════════
-- 6) Valores por defecto de los interruptores nuevos (sin pisar los existentes)
-- ═══════════════════════════════════════════════════════════════════════════
UPDATE public.site_settings
   SET value = jsonb_build_object(
         'enable_lives_doctors',   true,
         'enable_lives_residents', false,
         'enable_lives_patients',  false,
         'block_vpn_signup',       false,
         'enable_content_ratings', true
       ) || value            -- lo ya guardado manda
 WHERE id = 'feature_toggles';

INSERT INTO public.site_settings (id, value)
SELECT 'feature_toggles', jsonb_build_object(
         'enable_lives_doctors',   true,
         'enable_lives_residents', false,
         'enable_lives_patients',  false,
         'block_vpn_signup',       false,
         'enable_content_ratings', true)
WHERE NOT EXISTS (SELECT 1 FROM public.site_settings WHERE id = 'feature_toggles');


-- ═══════════════════════════════════════════════════════════════════════════
-- 7) VIDEOCONFERENCIA RESIDENTE ↔ MÉDICO y RESIDENTE ↔ RESIDENTE
-- ═══════════════════════════════════════════════════════════════════════════
-- Petición del cliente (2026-08-28). Las reuniones (clinical_sessions, sala de
-- Daily.co) sólo las podía crear un médico aprobado y sólo se podía invitar a
-- médicos aprobados: un residente NO podía organizar ni ser invitado, aunque la
-- pantalla de Reuniones ya se lo ofrecía. El chat residente↔residente y
-- residente↔médico ya estaba permitido en chat_sessions y no se toca.
DROP POLICY IF EXISTS "Approved residents can create clinical sessions" ON public.clinical_sessions;
CREATE POLICY "Approved residents can create clinical sessions" ON public.clinical_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    organizer_id = (SELECT auth.uid())
    AND public.is_approved_resident((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Organizers can invite approved doctors" ON public.clinical_session_invitations;
CREATE POLICY "Organizers can invite approved doctors" ON public.clinical_session_invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_is_invitation_organizer(session_id, (SELECT auth.uid()))
    AND (public.is_approved_doctor(doctor_id) OR public.is_approved_resident(doctor_id))
  );
