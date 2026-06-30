-- Algoritmo de recomendación por intereses (cliente 2026-06-29):
-- "según lo que voy buscando, que me vaya mostrando cosas de eso".
-- Registramos las búsquedas del usuario para derivar sus intereses (términos /
-- especialidades) y priorizar contenido afín (lives, casos, contenido).

CREATE TABLE IF NOT EXISTS public.search_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query text NOT NULL,
  specialty text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_events_user_created
  ON public.search_events (user_id, created_at DESC);

ALTER TABLE public.search_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own search events" ON public.search_events;
CREATE POLICY "Users insert own search events"
ON public.search_events FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users read own search events" ON public.search_events;
CREATE POLICY "Users read own search events"
ON public.search_events FOR SELECT TO authenticated
USING (user_id = auth.uid());

GRANT SELECT, INSERT ON public.search_events TO authenticated;

-- Intereses derivados del usuario: top términos de sus búsquedas recientes (90 días).
CREATE OR REPLACE FUNCTION public.get_user_interests(p_limit integer DEFAULT 5)
RETURNS TABLE(term text, hits bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT lower(trim(coalesce(specialty, query))) AS term, count(*) AS hits
  FROM public.search_events
  WHERE user_id = auth.uid()
    AND created_at > now() - interval '90 days'
    AND length(trim(coalesce(specialty, query))) >= 3
  GROUP BY 1
  ORDER BY hits DESC, max(created_at) DESC
  LIMIT GREATEST(p_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_user_interests(integer) TO authenticated;
