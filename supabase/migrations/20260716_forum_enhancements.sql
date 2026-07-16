-- FORO — mejoras (cliente 16-jul-2026): imágenes en posts y comentarios,
-- comentarios anidados (1 nivel), bucket público de imágenes y notificación a
-- TODOS los doctores aprobados al publicar. Idempotente; NO altera el anonimato
-- de los posts (la vista sigue anulando author_id de anónimos).

-- 1) Nuevas columnas ------------------------------------------------------------
ALTER TABLE public.forum_posts
  ADD COLUMN IF NOT EXISTS image_url text;

ALTER TABLE public.forum_comments
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS parent_comment_id uuid REFERENCES public.forum_comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_forum_comments_parent
  ON public.forum_comments (parent_comment_id);

-- El CHECK original exigía body de 1..4000 → un comentario SOLO-imagen (sin texto)
-- lo violaría. Se permite body vacío cuando hay imagen adjunta.
ALTER TABLE public.forum_comments DROP CONSTRAINT IF EXISTS forum_comments_body_check;
ALTER TABLE public.forum_comments
  ADD CONSTRAINT forum_comments_body_check
  CHECK (char_length(body) <= 4000 AND (char_length(body) >= 1 OR image_url IS NOT NULL));

-- 2) Recrear la vista para incluir image_url ------------------------------------
-- Idéntica a la de 20260715_forum.sql salvo el nuevo image_url: security_invoker
-- false (corre como owner y re-aplica la membresía en el WHERE), anula author_id
-- de anónimos y expone is_mine para el botón de borrar del dueño.
CREATE OR REPLACE VIEW public.forum_posts_feed
WITH (security_invoker = false) AS
SELECT
  id,
  CASE WHEN is_anonymous THEN NULL ELSE author_id END AS author_id,
  (author_id = auth.uid()) AS is_mine,
  category, title, body, is_anonymous, created_at, image_url
FROM public.forum_posts
WHERE public.is_forum_member(auth.uid());

-- Re-otorgar permisos de la vista (idempotente).
GRANT SELECT ON public.forum_posts_feed TO authenticated;
REVOKE ALL ON public.forum_posts_feed FROM anon;

-- 3) Bucket público de imágenes del foro ----------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('forum-images', 'forum-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Lectura pública (bucket público) y subida solo para miembros del gremio.
DROP POLICY IF EXISTS "forum-images public read" ON storage.objects;
CREATE POLICY "forum-images public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'forum-images');

DROP POLICY IF EXISTS "forum-images member upload" ON storage.objects;
CREATE POLICY "forum-images member upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'forum-images'
    AND auth.uid() IS NOT NULL
    AND public.is_forum_member(auth.uid())
  );

-- 4) Notificar a TODOS los doctores aprobados al publicar -----------------------
-- SECURITY DEFINER: inserta notificaciones a nombre del sistema (evita el
-- fan-out con RLS del cliente y funciona igual si publica un residente). Solo un
-- miembro del gremio puede dispararla; nunca se auto-notifica al autor.
CREATE OR REPLACE FUNCTION public.forum_notify_doctors(p_post_id uuid, p_title text, p_category text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_forum_member(auth.uid()) THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, type, title, message, data)
  SELECT dp.user_id, 'system', 'Nueva publicación en el Foro', left(p_title, 140),
         jsonb_build_object('kind', 'forum_post', 'post_id', p_post_id, 'deeplink', '/foro')
  FROM public.doctor_profiles dp
  WHERE dp.status = 'approved' AND dp.user_id <> auth.uid();
END; $$;

REVOKE ALL ON FUNCTION public.forum_notify_doctors(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.forum_notify_doctors(uuid, text, text) TO authenticated;
