-- La bitácora de «Revelar autor» debe SOBREVIVIR al borrado del post o del admin.
-- Antes: FK ON DELETE CASCADE borraba la huella al borrar el post anónimo.
ALTER TABLE public.forum_reveal_audit ALTER COLUMN post_id DROP NOT NULL;
ALTER TABLE public.forum_reveal_audit ALTER COLUMN admin_id DROP NOT NULL;
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.forum_reveal_audit'::regclass AND contype='f' LOOP
    EXECUTE format('ALTER TABLE public.forum_reveal_audit DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.forum_reveal_audit
  ADD CONSTRAINT forum_reveal_audit_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.forum_posts(id) ON DELETE SET NULL,
  ADD CONSTRAINT forum_reveal_audit_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES auth.users(id) ON DELETE SET NULL;
