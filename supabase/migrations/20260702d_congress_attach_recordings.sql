-- Adjuntar/quitar grabaciones de Contenido Premium a un congreso desde la UI
-- (cliente 2026-07-02, ronda diseño). RLS de recordings solo deja al dueño
-- editar su fila; este RPC extiende el permiso a los managers del congreso
-- (organizador/líder/admin) SOLO para el campo congress_id.
-- Al adjuntar, el dueño del video queda registrado como conferencista.

CREATE OR REPLACE FUNCTION public.set_recording_congress(p_recording_id uuid, p_congress_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _owner uuid;
  _current uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  SELECT doctor_id, congress_id INTO _owner, _current FROM recordings WHERE id = p_recording_id;
  IF _owner IS NULL THEN
    RAISE EXCEPTION 'recording not found';
  END IF;

  IF p_congress_id IS NOT NULL THEN
    IF auth.uid() <> _owner AND NOT can_manage_congress(p_congress_id, auth.uid()) THEN
      RAISE EXCEPTION 'not allowed';
    END IF;
    UPDATE recordings SET congress_id = p_congress_id WHERE id = p_recording_id;
    INSERT INTO congress_speakers (congress_id, user_id, added_by)
    VALUES (p_congress_id, _owner, auth.uid())
    ON CONFLICT (congress_id, user_id) DO NOTHING;
  ELSE
    IF auth.uid() <> _owner AND (_current IS NULL OR NOT can_manage_congress(_current, auth.uid())) THEN
      RAISE EXCEPTION 'not allowed';
    END IF;
    UPDATE recordings SET congress_id = NULL WHERE id = p_recording_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_recording_congress(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.set_recording_congress(uuid, uuid) FROM anon;
