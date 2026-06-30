-- Chats exclusivos por distintivo (cliente 2026-06-29):
--   - Doctores con MEDALLA (gold) tienen un chat solo de medallas.
--   - Doctores con PALOMITA (verified) tienen un chat solo de palomitas.
--   - Un medalla NO ve el chat de palomita y viceversa (RLS por badge).
-- Modelo simple: una tabla de mensajes de "sala por badge". La sala es implícita
-- (la columna badge). El acceso se controla por el distintivo del usuario actual.

CREATE TABLE IF NOT EXISTS public.badge_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  badge text NOT NULL CHECK (badge IN ('gold','verified')),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_badge_chat_messages_badge_created
  ON public.badge_chat_messages (badge, created_at);

ALTER TABLE public.badge_chat_messages ENABLE ROW LEVEL SECURITY;

-- Distintivo del usuario actual (SECURITY DEFINER para no chocar con RLS de doctor_profiles).
CREATE OR REPLACE FUNCTION public.current_user_badge()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT manual_badge FROM public.doctor_profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.current_user_badge() TO authenticated;

DROP POLICY IF EXISTS "badge members can read" ON public.badge_chat_messages;
CREATE POLICY "badge members can read"
ON public.badge_chat_messages FOR SELECT TO authenticated
USING (badge = public.current_user_badge());

DROP POLICY IF EXISTS "badge members can write" ON public.badge_chat_messages;
CREATE POLICY "badge members can write"
ON public.badge_chat_messages FOR INSERT TO authenticated
WITH CHECK (sender_id = auth.uid() AND badge = public.current_user_badge());

GRANT SELECT, INSERT ON public.badge_chat_messages TO authenticated;

-- Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'badge_chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.badge_chat_messages;
  END IF;
END $$;
