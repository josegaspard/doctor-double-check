-- =========================================================================
-- Endurecimiento de seguridad 2026-07-16 · RONDA 2 (auditoría MEGA completa)
-- Idempotente. Aplicable a prod tal cual.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1) P0 — FUGA MASIVA DE ARCHIVOS CLÍNICOS DEL CHAT (bucket 'documents').
--    La policy "Chat file view" permitía a CUALQUIER usuario autenticado leer
--    TODOS los archivos del chat (laboratorios, imágenes, documentos médicos)
--    de todos los pacientes — el comentario original lo asumía "seguro porque
--    necesitan la URL", falso: con SELECT sobre el bucket se listan/descargan.
--    Ruta: chat/{sessionId}/{uploaderId}/{archivo}. Se restringe a: el que subió,
--    admin, o un participante real de esa sesión de chat.
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "Chat file view" ON storage.objects;
CREATE POLICY "Chat file view (participants only)"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = 'chat'
  AND (
    (storage.foldername(name))[3] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.chat_sessions cs
      WHERE cs.id::text = (storage.foldername(name))[2]
        AND (cs.participant1_id = auth.uid() OR cs.participant2_id = auth.uid())
    )
  )
);

-- -------------------------------------------------------------------------
-- 2) LFPDPPP — Evidencia de consentimiento del aviso de privacidad.
--    Tabla de bitácora + trigger server-side que registra el consentimiento a
--    partir de la metadata del signUp (a prueba de manipulación, funciona aun
--    con confirmación de correo pendiente). El frontend debe pasar en
--    options.data: consent_accepted:'true', consent_ethics, consent_version,
--    consent_user_agent (parche de frontend aparte; la tabla queda lista ya).
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.consent_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type text NOT NULL,          -- 'terms_privacy' | 'ethics'
  document_version text,               -- versión del aviso aceptada
  accepted_at timestamptz NOT NULL DEFAULT now(),
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.consent_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own consent" ON public.consent_log;
CREATE POLICY "Users view own consent" ON public.consent_log
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- El usuario NO inserta directo (lo hace el trigger con service context); sin
-- policy de INSERT, authenticated no puede escribir filas arbitrarias.
CREATE INDEX IF NOT EXISTS idx_consent_log_user ON public.consent_log(user_id);

CREATE OR REPLACE FUNCTION public.record_signup_consent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.raw_user_meta_data->>'consent_accepted', '') = 'true' THEN
    INSERT INTO public.consent_log (user_id, consent_type, document_version, accepted_at, user_agent)
    VALUES (NEW.id, 'terms_privacy',
            NEW.raw_user_meta_data->>'consent_version',
            now(),
            NEW.raw_user_meta_data->>'consent_user_agent');

    IF COALESCE(NEW.raw_user_meta_data->>'consent_ethics', '') = 'true' THEN
      INSERT INTO public.consent_log (user_id, consent_type, document_version, accepted_at, user_agent)
      VALUES (NEW.id, 'ethics',
              NEW.raw_user_meta_data->>'consent_version',
              now(),
              NEW.raw_user_meta_data->>'consent_user_agent');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_signup_consent ON auth.users;
CREATE TRIGGER trg_record_signup_consent
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.record_signup_consent();
