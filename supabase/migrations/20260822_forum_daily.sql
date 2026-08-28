-- MÓDULO DIARIO DE LA COMUNIDAD (cliente 22-ago-2026, brief del doctor vía Marta):
-- «preguntas diarias» por categoría (caso / complicación anónima / técnica-perla /
-- innovación), portada «Hoy», especialidad y adjuntos en cada publicación, «Revelar»
-- solo para súper admin con bitácora, aviso diario y aviso de comentarios.
-- TODO ADITIVO sobre 20260715_forum.sql + 20260716_forum_enhancements.sql. Idempotente.
-- Zona horaria del «día»: America/Mexico_City (UTC-6 fijo desde 2022).

-- 1) Propuestas del día -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.forum_daily_prompts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_date date NOT NULL,
  category    text NOT NULL CHECK (category IN (
    'caso_clinico', 'complicacion', 'innovacion', 'perla_quirurgica', 'caso_exito')),
  title       text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 300),
  body        text CHECK (body IS NULL OR char_length(body) <= 4000),
  image_url   text,
  source      text NOT NULL DEFAULT 'admin' CHECK (source IN ('admin', 'bank')),
  bank_id     uuid,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prompt_date, category)
);
CREATE INDEX IF NOT EXISTS idx_forum_daily_prompts_date
  ON public.forum_daily_prompts (prompt_date DESC, category);

-- 2) Banco de preguntas (respaldo automático cuando el equipo no escribió la del día) ----
CREATE TABLE IF NOT EXISTS public.forum_prompt_bank (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category     text NOT NULL CHECK (category IN (
    'caso_clinico', 'complicacion', 'innovacion', 'perla_quirurgica', 'caso_exito')),
  title        text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 300),
  body         text CHECK (body IS NULL OR char_length(body) <= 4000),
  is_active    boolean NOT NULL DEFAULT true,
  last_used_on date,
  use_count    integer NOT NULL DEFAULT 0,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_forum_prompt_bank_cat
  ON public.forum_prompt_bank (category, is_active, last_used_on);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'forum_daily_prompts_bank_fk') THEN
    ALTER TABLE public.forum_daily_prompts
      ADD CONSTRAINT forum_daily_prompts_bank_fk
      FOREIGN KEY (bank_id) REFERENCES public.forum_prompt_bank(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3) Bitácora de «Revelar» (quién consultó el autor de una complicación anónima) ------
CREATE TABLE IF NOT EXISTS public.forum_reveal_audit (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  admin_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason      text,
  revealed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_forum_reveal_audit_post ON public.forum_reveal_audit (post_id);

-- 4) Registro de ejecuciones del día (idempotencia del aviso diario) ---------------------
CREATE TABLE IF NOT EXISTS public.forum_daily_runs (
  prompt_date     date PRIMARY KEY,
  prompts_created integer NOT NULL DEFAULT 0,
  notified        integer NOT NULL DEFAULT 0,
  ran_at          timestamptz NOT NULL DEFAULT now()
);

-- 5) Columnas nuevas en las publicaciones -----------------------------------------------
ALTER TABLE public.forum_posts ADD COLUMN IF NOT EXISTS specialty   text;
ALTER TABLE public.forum_posts ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.forum_posts ADD COLUMN IF NOT EXISTS prompt_id   uuid
  REFERENCES public.forum_daily_prompts(id) ON DELETE SET NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'forum_posts_attachments_check') THEN
    ALTER TABLE public.forum_posts ADD CONSTRAINT forum_posts_attachments_check
      CHECK (jsonb_typeof(attachments) = 'array' AND jsonb_array_length(attachments) <= 8);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_forum_posts_prompt ON public.forum_posts (prompt_id);

-- 6) Vista del feed: mismas garantías de anonimato + columnas nuevas + nº comentarios ----
-- (CREATE OR REPLACE solo puede AÑADIR columnas al final: se respeta el orden previo.)
CREATE OR REPLACE VIEW public.forum_posts_feed
WITH (security_invoker = false) AS
SELECT
  p.id,
  CASE WHEN p.is_anonymous THEN NULL ELSE p.author_id END AS author_id,
  (p.author_id = auth.uid()) AS is_mine,
  p.category, p.title, p.body, p.is_anonymous, p.created_at, p.image_url,
  p.specialty, p.attachments, p.prompt_id,
  (SELECT count(*) FROM public.forum_comments c WHERE c.post_id = p.id)::int AS comment_count
FROM public.forum_posts p
WHERE public.is_forum_member(auth.uid());
GRANT SELECT ON public.forum_posts_feed TO authenticated;
REVOKE ALL ON public.forum_posts_feed FROM anon;

-- 7) RLS de las tablas nuevas ------------------------------------------------------------
ALTER TABLE public.forum_daily_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_prompt_bank   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_reveal_audit  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_daily_runs    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Forum members read daily prompts" ON public.forum_daily_prompts;
CREATE POLICY "Forum members read daily prompts" ON public.forum_daily_prompts
  FOR SELECT USING (public.is_forum_member(auth.uid()));
DROP POLICY IF EXISTS "Admins manage daily prompts" ON public.forum_daily_prompts;
CREATE POLICY "Admins manage daily prompts" ON public.forum_daily_prompts
  FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage prompt bank" ON public.forum_prompt_bank;
CREATE POLICY "Admins manage prompt bank" ON public.forum_prompt_bank
  FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins read reveal audit" ON public.forum_reveal_audit;
CREATE POLICY "Admins read reveal audit" ON public.forum_reveal_audit
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins read daily runs" ON public.forum_daily_runs;
CREATE POLICY "Admins read daily runs" ON public.forum_daily_runs
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.forum_daily_prompts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forum_prompt_bank   TO authenticated;
GRANT SELECT ON public.forum_reveal_audit TO authenticated;
GRANT SELECT ON public.forum_daily_runs   TO authenticated;
REVOKE ALL ON public.forum_daily_prompts FROM anon;
REVOKE ALL ON public.forum_prompt_bank   FROM anon;
REVOKE ALL ON public.forum_reveal_audit  FROM anon;
REVOKE ALL ON public.forum_daily_runs    FROM anon;

-- 8) Depósito PRIVADO de adjuntos (imágenes, video, PDF) --------------------------------
-- Las rutas NO llevan el id del autor (un miembro podría desanonimizar una Complicación
-- leyendo la ruta del adjunto): se guardan en p/<uuid aleatorio>/<nombre>. Solo miembros
-- del gremio leen (vía URL firmada); suben miembros; borra solo admin.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('forum-files', 'forum-files', false, 52428800,
        ARRAY['image/jpeg','image/png','image/webp','image/gif',
              'video/mp4','video/quicktime','video/webm','application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET public = false, file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "forum-files member read" ON storage.objects;
CREATE POLICY "forum-files member read" ON storage.objects
  FOR SELECT USING (bucket_id = 'forum-files' AND public.is_forum_member(auth.uid()));
DROP POLICY IF EXISTS "forum-files member upload" ON storage.objects;
CREATE POLICY "forum-files member upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'forum-files' AND auth.uid() IS NOT NULL
    AND public.is_forum_member(auth.uid())
    AND (storage.foldername(name))[1] = 'p'
  );
DROP POLICY IF EXISTS "forum-files admin delete" ON storage.objects;
CREATE POLICY "forum-files admin delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'forum-files' AND public.has_role(auth.uid(), 'admin'));

-- 9) «Revelar» autor de una publicación anónima: SOLO súper admin, con bitácora ----------
CREATE OR REPLACE FUNCTION public.forum_admin_reveal(p_post_id uuid, p_reason text DEFAULT NULL)
RETURNS TABLE (author_id uuid, name text, email text, doctor_code text, doctor_number integer,
               specialty text, role text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.forum_reveal_audit (post_id, admin_id, reason)
  VALUES (p_post_id, auth.uid(), p_reason);
  RETURN QUERY
  SELECT fp.author_id, pr.name, pr.email, dp.doctor_code, dp.doctor_number,
         COALESCE(dp.specialty, fp.specialty),
         (SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = fp.author_id LIMIT 1)
  FROM public.forum_posts fp
  LEFT JOIN public.profiles pr ON pr.id = fp.author_id
  LEFT JOIN public.doctor_profiles dp ON dp.user_id = fp.author_id
  WHERE fp.id = p_post_id;
END; $$;
REVOKE ALL ON FUNCTION public.forum_admin_reveal(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.forum_admin_reveal(uuid, text) TO authenticated;

-- 10) Motor del día: crea las propuestas que falten (del banco) y manda el aviso diario ---
-- La llama pg_cron a las 07:00 CDMX y también la app (de forma perezosa, idempotente)
-- cuando un miembro abre la Comunidad; el aviso solo sale una vez por fecha y nunca
-- antes de las 07:00 CDMX salvo que lo dispare el cron.
DROP FUNCTION IF EXISTS public.forum_publish_daily(date);
CREATE OR REPLACE FUNCTION public.forum_publish_daily(
  p_date date DEFAULT ((now() AT TIME ZONE 'America/Mexico_City')::date),
  p_notify boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  FOREACH _cat IN ARRAY ARRAY['caso_clinico', 'complicacion', 'perla_quirurgica', 'innovacion'] LOOP
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
           COALESCE(left(_title, 140), 'Caso, complicación, técnica e innovación del día te esperan en la Comunidad.'),
           jsonb_build_object('kind', 'forum_daily', 'date', p_date, 'url', '/foro', 'deeplink', '/foro')
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
END; $$;
REVOKE ALL ON FUNCTION public.forum_publish_daily(date, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.forum_publish_daily(date, boolean) TO authenticated;

-- 11) Aviso al autor cuando comentan su publicación (y al autor del comentario respondido) -
CREATE OR REPLACE FUNCTION public.forum_comment_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _post record; _parent_author uuid; _who text; _snippet text;
BEGIN
  SELECT author_id, title INTO _post FROM public.forum_posts WHERE id = NEW.post_id;
  SELECT COALESCE(NULLIF(name, ''), 'Un colega') INTO _who FROM public.profiles WHERE id = NEW.author_id;
  _snippet := left(COALESCE(_who, 'Un colega') || ': ' || COALESCE(NULLIF(NEW.body, ''), '(imagen)'), 140);
  IF _post.author_id IS NOT NULL AND _post.author_id <> NEW.author_id THEN
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (_post.author_id, 'system', 'Nuevo comentario en tu publicación', _snippet,
            jsonb_build_object('kind', 'forum_comment', 'post_id', NEW.post_id,
                               'url', '/foro?post=' || NEW.post_id::text));
  END IF;
  IF NEW.parent_comment_id IS NOT NULL THEN
    SELECT author_id INTO _parent_author FROM public.forum_comments WHERE id = NEW.parent_comment_id;
    IF _parent_author IS NOT NULL AND _parent_author <> NEW.author_id
       AND _parent_author IS DISTINCT FROM _post.author_id THEN
      INSERT INTO public.notifications (user_id, type, title, message, data)
      VALUES (_parent_author, 'system', 'Respondieron a tu comentario', _snippet,
              jsonb_build_object('kind', 'forum_reply', 'post_id', NEW.post_id,
                                 'url', '/foro?post=' || NEW.post_id::text));
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_forum_comment_notify ON public.forum_comments;
CREATE TRIGGER trg_forum_comment_notify
  AFTER INSERT ON public.forum_comments
  FOR EACH ROW EXECUTE FUNCTION public.forum_comment_notify();

-- 12) Aviso al publicar: ahora también a residentes aprobados, y con url navegable ---------
CREATE OR REPLACE FUNCTION public.forum_notify_doctors(p_post_id uuid, p_title text, p_category text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_forum_member(auth.uid()) THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, type, title, message, data)
  SELECT u.user_id, 'system', 'Nueva publicación en la Comunidad', left(p_title, 140),
         jsonb_build_object('kind', 'forum_post', 'post_id', p_post_id, 'category', p_category,
                            'url', '/foro?post=' || p_post_id::text, 'deeplink', '/foro')
  FROM (
    SELECT dp.user_id FROM public.doctor_profiles dp WHERE dp.status = 'approved'
    UNION
    SELECT rp.user_id FROM public.resident_profiles rp WHERE rp.status = 'approved'
  ) u
  WHERE u.user_id <> auth.uid();
END; $$;
REVOKE ALL ON FUNCTION public.forum_notify_doctors(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.forum_notify_doctors(uuid, text, text) TO authenticated;

-- 13) Cron 07:00 CDMX = 13:00 UTC (si pg_cron está disponible) ---------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'forum-daily-prompts') THEN
      PERFORM cron.schedule('forum-daily-prompts', '0 13 * * *', 'SELECT public.forum_publish_daily();');
    END IF;
  END IF;
END $$;

-- 14) Banco inicial (solo si está vacío): 10 preguntas por categoría ----------------------
INSERT INTO public.forum_prompt_bank (category, title)
SELECT * FROM (VALUES
  ('caso_clinico', 'Paciente de 54 años con dolor torácico atípico y troponina limítrofe. ¿Cómo lo abordarías y qué decidiría el ingreso?'),
  ('caso_clinico', 'Fiebre prolongada sin foco tras dos semanas de estudio. ¿Qué pasos te quedan antes de hablar de fiebre de origen desconocido?'),
  ('caso_clinico', 'Dolor en fosa ilíaca derecha con imagen no concluyente. ¿Cirugía, observación o más estudios? Cuenta tu secuencia.'),
  ('caso_clinico', 'Adulto joven con cefalea de inicio súbito y exploración normal. ¿Qué descartas primero y con qué?'),
  ('caso_clinico', 'Paciente anticoagulado que llega con hematuria y anemia progresiva. ¿Cómo ordenas las prioridades?'),
  ('caso_clinico', 'Nódulo tiroideo incidental de 1,5 cm. ¿Qué criterios te llevan a puncionar o a vigilar?'),
  ('caso_clinico', 'Diabético con úlcera en el pie de 3 semanas y eritema ascendente. ¿Antibiótico, imagen, cirugía? ¿En qué orden?'),
  ('caso_clinico', 'Mujer de 32 años con palpitaciones y TSH suprimida. ¿Cuál es tu algoritmo diagnóstico y terapéutico?'),
  ('caso_clinico', 'Adulto mayor con caída en casa y confusión nueva. ¿Qué no se te puede escapar en urgencias?'),
  ('caso_clinico', 'El caso que más te hizo cambiar de opinión este mes: qué pensaste al inicio y qué resultó ser.'),
  ('complicacion', 'Dehiscencia de anastomosis al quinto día posoperatorio. ¿Qué harías hoy y qué cambiarías en el preoperatorio?'),
  ('complicacion', 'Sangrado posoperatorio que obliga a reintervenir. ¿Cómo lo comunicas a la familia y qué revisas del procedimiento?'),
  ('complicacion', 'Lesión de vía biliar advertida durante una colecistectomía. ¿Reparas, derivas o conviertes? Cuenta tu experiencia.'),
  ('complicacion', 'Infección profunda de sitio quirúrgico pese a profilaxis correcta. ¿Qué revisarías del proceso?'),
  ('complicacion', 'Reacción adversa grave a un fármaco que tú indicaste. ¿Cómo actuaste en las primeras horas?'),
  ('complicacion', 'Retraso diagnóstico que cambió el pronóstico. ¿Qué señal se pasó por alto y cómo evitarlo la próxima vez?'),
  ('complicacion', 'Complicación anestésica inesperada en cirugía programada. ¿Qué protocolo activaste y qué faltó?'),
  ('complicacion', 'Paciente que empeora tras el alta y reingresa. ¿Qué criterio de alta reconsiderarías?'),
  ('complicacion', 'Falla de un dispositivo o implante. ¿Cómo lo detectaste y qué hiciste después?'),
  ('complicacion', 'Una complicación que no está resuelta y te quita el sueño: cuéntala aquí, de forma anónima, y deja que el gremio aporte.'),
  ('perla_quirurgica', 'Comparte una técnica o modificación que te ahorre tiempo en quirófano sin perder seguridad.'),
  ('perla_quirurgica', '¿Qué truco usas para un cierre de fascia más rápido y con menos complicaciones?'),
  ('perla_quirurgica', 'Una maniobra que aprendiste de un maestro y que hoy enseñas a tus residentes.'),
  ('perla_quirurgica', '¿Cómo preparas el campo y la posición en un procedimiento difícil? Una recomendación concreta.'),
  ('perla_quirurgica', 'El error frecuente que ves en residentes y cómo lo corriges en una frase.'),
  ('perla_quirurgica', 'Un consejo de hemostasia que no está en los libros.'),
  ('perla_quirurgica', 'Tu regla personal para decidir la conversión en cirugía laparoscópica.'),
  ('perla_quirurgica', 'Una perla de manejo del dolor posoperatorio que mejora el alta.'),
  ('perla_quirurgica', 'Un instrumento o material poco usado que para ti marca la diferencia.'),
  ('perla_quirurgica', 'Hoy quiero enseñar a la comunidad algo que a mí me funciona: ¿cuál es tu perla?'),
  ('innovacion', 'Prótesis de titanio poroso para favorecer la osteointegración. ¿Qué aplicación clínica le ves y qué riesgos?'),
  ('innovacion', 'Impresión 3D de modelos anatómicos para planificación quirúrgica. ¿Ya la usas? ¿Qué cambió?'),
  ('innovacion', 'IA como apoyo al diagnóstico por imagen. ¿Dónde ayuda de verdad y dónde no confiarías?'),
  ('innovacion', 'Cirugía robótica: ¿qué procedimiento se beneficia más y cuál no justifica el costo?'),
  ('innovacion', 'Biomateriales reabsorbibles: ¿en qué indicación te gustaría probarlos?'),
  ('innovacion', 'Monitorización remota de pacientes crónicos: ¿qué dato te gustaría recibir cada mañana?'),
  ('innovacion', 'Un artículo reciente que cambió tu práctica: resume la idea y abre el debate.'),
  ('innovacion', 'Nuevas terapias dirigidas o biológicas en tu especialidad: ¿cuál te entusiasma y por qué?'),
  ('innovacion', 'Telemedicina en el seguimiento posoperatorio: ¿qué funciona y qué no reemplaza la consulta?'),
  ('innovacion', 'Una tecnología emergente de la que casi nadie habla y que deberíamos vigilar.')
) AS v(category, title)
WHERE NOT EXISTS (SELECT 1 FROM public.forum_prompt_bank);

-- 15) Crear las propuestas de hoy ya mismo, SIN aviso (el aviso lo da el cron a las 07:00) -
SELECT public.forum_publish_daily(p_notify => false);
