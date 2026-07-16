-- FORO (cliente 15-jul-2026): discusión solo para doctores/residentes (+admin).
-- 5 categorías fijas del día. "Complicación del día" es ANÓNIMA: se guarda el
-- author_id (trazabilidad legal) pero la UI muestra "Anónimo"; el nombre nunca
-- se expone porque los nombres se resuelven client-side vía profiles_public y
-- para posts anónimos simplemente no se consulta. Idempotente.

CREATE TABLE IF NOT EXISTS public.forum_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN (
    'caso_clinico', 'complicacion', 'innovacion', 'perla_quirurgica', 'caso_exito'
  )),
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 10000),
  is_anonymous boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.forum_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forum_posts_category_created
  ON public.forum_posts (category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_comments_post
  ON public.forum_comments (post_id, created_at);

ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_comments ENABLE ROW LEVEL SECURITY;

-- Helper: ¿el usuario es del gremio (doctor/residente/admin)?
CREATE OR REPLACE FUNCTION public.is_forum_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'doctor')
      OR public.has_role(_user_id, 'resident')
      OR public.has_role(_user_id, 'admin')
$$;

-- Solo el gremio VE y PUBLICA (la ruta /foro ya está gateada igual en el front).
DROP POLICY IF EXISTS "Forum members can read posts" ON public.forum_posts;
CREATE POLICY "Forum members can read posts" ON public.forum_posts
  FOR SELECT USING (public.is_forum_member(auth.uid()));

DROP POLICY IF EXISTS "Forum members can create posts" ON public.forum_posts;
CREATE POLICY "Forum members can create posts" ON public.forum_posts
  FOR INSERT WITH CHECK (auth.uid() = author_id AND public.is_forum_member(auth.uid()));

DROP POLICY IF EXISTS "Authors and admins can delete posts" ON public.forum_posts;
CREATE POLICY "Authors and admins can delete posts" ON public.forum_posts
  FOR DELETE USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Forum members can read comments" ON public.forum_comments;
CREATE POLICY "Forum members can read comments" ON public.forum_comments
  FOR SELECT USING (public.is_forum_member(auth.uid()));

DROP POLICY IF EXISTS "Forum members can create comments" ON public.forum_comments;
CREATE POLICY "Forum members can create comments" ON public.forum_comments
  FOR INSERT WITH CHECK (auth.uid() = author_id AND public.is_forum_member(auth.uid()));

DROP POLICY IF EXISTS "Authors and admins can delete comments" ON public.forum_comments;
CREATE POLICY "Authors and admins can delete comments" ON public.forum_comments
  FOR DELETE USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));

-- anon jamás toca el foro
REVOKE ALL ON public.forum_posts FROM anon;
REVOKE ALL ON public.forum_comments FROM anon;

-- ANONIMATO REAL: la RLS es a nivel de FILA, no de columna → un SELECT * sobre
-- forum_posts devolvería author_id incluso de los posts anónimos, y cualquier
-- miembro podría resolver ese id contra profiles_public y desanonimizar una
-- "Complicación del día". Se lee por una VISTA que ANULA author_id cuando el
-- post es anónimo y expone un flag is_mine (para el botón de borrar del dueño).
-- security_invoker=false: la vista corre con privilegios del owner (evita la RLS
-- de la tabla base que reemplaza) y re-aplica la membresía en el WHERE.
CREATE OR REPLACE VIEW public.forum_posts_feed
WITH (security_invoker = false) AS
SELECT
  id,
  CASE WHEN is_anonymous THEN NULL ELSE author_id END AS author_id,
  (author_id = auth.uid()) AS is_mine,
  category, title, body, is_anonymous, created_at
FROM public.forum_posts
WHERE public.is_forum_member(auth.uid());

-- authenticated ya NO lee la tabla base directa (así author_id anónimo nunca
-- sale); solo necesita SELECT(id) para el filtro .eq('id',…) del DELETE. Las
-- inserciones/borrados siguen contra forum_posts y sus policies (return=minimal).
REVOKE SELECT ON public.forum_posts FROM authenticated;
GRANT SELECT (id) ON public.forum_posts TO authenticated;
GRANT SELECT ON public.forum_posts_feed TO authenticated;
REVOKE ALL ON public.forum_posts_feed FROM anon;
