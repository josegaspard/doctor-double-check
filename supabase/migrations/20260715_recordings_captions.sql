-- Subtítulos automáticos para grabaciones (contenido premium en Bunny Stream).
-- Bunny genera y ALMACENA las pistas de subtítulos del lado de su CDN; aquí solo
-- rastreamos el estado del pedido y qué idiomas se solicitaron, para pintar el
-- badge/estado en el panel del médico. Idempotente.

ALTER TABLE public.recordings
  ADD COLUMN IF NOT EXISTS captions_status text,            -- null | 'processing' | 'ready' | 'failed'
  ADD COLUMN IF NOT EXISTS captions_source_lang text,       -- ISO 639-1 del idioma hablado (p.ej. 'es')
  ADD COLUMN IF NOT EXISTS captions_languages text[] DEFAULT '{}',  -- idiomas generados/solicitados
  ADD COLUMN IF NOT EXISTS captions_updated_at timestamptz;

-- Consistente con 20260517_recordings_anon_columns.sql: anon solo ve la whitelist.
-- captions_status es inocuo (sin PII) y permite mostrar el badge "CC" en listados
-- públicos de grabaciones. El resto de columnas de captions quedan fuera de anon.
GRANT SELECT (captions_status) ON public.recordings TO anon;
