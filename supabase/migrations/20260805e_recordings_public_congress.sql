-- ============================================================================
-- Añade congress_id a la vista pública de grabaciones
--
-- POR QUÉ: `recordings` no tiene GRANT de SELECT para `anon` (revocado a
-- propósito en 20260711_p1_anon_revoke_hardening), pero cuatro pantallas la
-- consultaban sin sesión — LivesContext, el buscador global, /congresos y
-- /congreso/:id — y devolvían 401 a todo visitante, ensuciando la consola.
--
-- La vista `recordings_public` existe justo para eso y ya expone las columnas
-- que necesitan… menos `congress_id`, que es por donde filtran las dos
-- pantallas de congresos. Se añade: es un identificador de agrupación, no
-- expone nada sensible (siguen fuera storage_path, bunny_video_id y demás).
-- ============================================================================

-- OJO: CREATE OR REPLACE VIEW sólo deja AÑADIR columnas AL FINAL; si se mete
-- congress_id en medio, Postgres lo interpreta como un renombrado y falla con
-- «cannot change name of view column». Por eso va el último.
CREATE OR REPLACE VIEW public.recordings_public AS
SELECT id,
       live_id,
       doctor_id,
       title,
       description,
       specialty,
       duration,
       price,
       thumbnail_url,
       tags,
       created_at,
       peak_viewers,
       price = 0::numeric AS is_free,
       congress_id
FROM public.recordings;

GRANT SELECT ON public.recordings_public TO anon, authenticated;
