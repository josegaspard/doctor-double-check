-- Badge por-id para mostrar el distintivo (medalla/palomita) en CUALQUIER superficie
-- donde aparezca un doctor (chat, citas, reseñas, etc.) sin plumbing de datos por query.
-- doctor_profiles tiene RLS "solo dueño/admin", así que un usuario normal NO puede leer
-- manual_badge de otro doctor directo → RPC SECURITY DEFINER que expone SOLO el badge
-- de doctores aprobados. Batched (array de ids) para 1 sola llamada por pantalla.
CREATE OR REPLACE FUNCTION public.get_doctor_badges(p_user_ids uuid[])
RETURNS TABLE(user_id uuid, manual_badge text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT dp.user_id, dp.manual_badge
  FROM public.doctor_profiles dp
  WHERE dp.user_id = ANY(p_user_ids)
    AND dp.status = 'approved'
    AND dp.manual_badge IN ('gold','verified');
$$;

GRANT EXECUTE ON FUNCTION public.get_doctor_badges(uuid[]) TO anon, authenticated;
