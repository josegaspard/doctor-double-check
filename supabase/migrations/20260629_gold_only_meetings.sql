-- Reuniones exclusivas entre MEDALLAS (cliente 2026-06-29):
-- un doctor con 🥇 medalla puede marcar una reunión como "solo medallas" y
-- únicamente otros doctores con medalla pueden verla/unirse. Los de palomita NO
-- quedan restringidos a hacer reuniones con los demás (solo aplica gold_only).

ALTER TABLE public.clinical_sessions
  ADD COLUMN IF NOT EXISTS gold_only boolean NOT NULL DEFAULT false;

-- Las reuniones públicas marcadas gold_only solo son visibles para doctores con medalla.
DROP POLICY IF EXISTS "Anyone can view public clinical sessions" ON public.clinical_sessions;
CREATE POLICY "Anyone can view public clinical sessions"
ON public.clinical_sessions FOR SELECT
USING (
  is_public = true
  AND (gold_only = false OR public.current_user_badge() = 'gold')
);
