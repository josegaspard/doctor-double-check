-- FORO — fix aviso (22-ago-2026): forum_notify_doctors guardaba data.deeplink='/foro'
-- pero NotificationBell (type 'system') navega con data.url → tocar el aviso no
-- hacía nada. Se añade url (y se conserva deeplink). Idempotente, sin cambios de esquema.
CREATE OR REPLACE FUNCTION public.forum_notify_doctors(p_post_id uuid, p_title text, p_category text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_forum_member(auth.uid()) THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, type, title, message, data)
  SELECT dp.user_id, 'system', 'Nueva publicación en el Foro', left(p_title, 140),
         jsonb_build_object('kind', 'forum_post', 'post_id', p_post_id, 'category', p_category,
                            'deeplink', '/foro', 'url', '/foro')
  FROM public.doctor_profiles dp
  WHERE dp.status = 'approved' AND dp.user_id <> auth.uid();
END; $$;
REVOKE ALL ON FUNCTION public.forum_notify_doctors(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.forum_notify_doctors(uuid, text, text) TO authenticated;
