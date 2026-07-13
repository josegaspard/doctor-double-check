-- QR tracking · ENRIQUECIMIENTO (medir "todo lo posible" de quien llega por el QR).
-- Añade dimensiones anónimas al escaneo (dispositivo, SO, navegador, país, ciudad,
-- región, idioma) y amplía la RPC del panel con desgloses. Sin PII: nada identifica
-- a la persona; el comportamiento DENTRO del sitio se mide en GA4 vía los UTM.

ALTER TABLE public.qr_scans
  ADD COLUMN IF NOT EXISTS device_type      text,   -- móvil / tablet / escritorio
  ADD COLUMN IF NOT EXISTS os               text,   -- iOS / Android / Windows / macOS / Linux
  ADD COLUMN IF NOT EXISTS browser          text,   -- Chrome / Safari / Firefox / Edge...
  ADD COLUMN IF NOT EXISTS city             text,
  ADD COLUMN IF NOT EXISTS region           text,
  ADD COLUMN IF NOT EXISTS accept_language  text;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC ampliada: además del conteo, devuelve desgloses por dispositivo, navegador,
-- SO, país, ciudad, hora del día (TZ CDMX) y los últimos 25 escaneos.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qr_campaign_stats(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT jsonb_build_object(
    'slug', p_slug,
    'total',        (SELECT count(*) FROM qr_scans WHERE campaign_slug = p_slug),
    'today',        (SELECT count(*) FROM qr_scans WHERE campaign_slug = p_slug AND scanned_at >= date_trunc('day', now() AT TIME ZONE 'America/Mexico_City') AT TIME ZONE 'America/Mexico_City'),
    'last7',        (SELECT count(*) FROM qr_scans WHERE campaign_slug = p_slug AND scanned_at >= now() - interval '7 days'),
    'last30',       (SELECT count(*) FROM qr_scans WHERE campaign_slug = p_slug AND scanned_at >= now() - interval '30 days'),
    'unique_est',   (SELECT count(DISTINCT ip_hash) FROM qr_scans WHERE campaign_slug = p_slug AND ip_hash IS NOT NULL),
    'last_scan_at', (SELECT max(scanned_at) FROM qr_scans WHERE campaign_slug = p_slug),

    'by_day', COALESCE((
      SELECT jsonb_agg(row_to_json(d) ORDER BY d.day)
      FROM (
        SELECT to_char(gs.day, 'YYYY-MM-DD') AS day, COALESCE(c.n, 0) AS scans
        FROM generate_series(
               (date_trunc('day', now() AT TIME ZONE 'America/Mexico_City') - interval '29 days')::date,
               (date_trunc('day', now() AT TIME ZONE 'America/Mexico_City'))::date,
               interval '1 day') AS gs(day)
        LEFT JOIN (
          SELECT (scanned_at AT TIME ZONE 'America/Mexico_City')::date AS day, count(*) AS n
          FROM qr_scans WHERE campaign_slug = p_slug AND scanned_at >= now() - interval '30 days'
          GROUP BY 1
        ) c ON c.day = gs.day::date
      ) d
    ), '[]'::jsonb),

    'by_hour', COALESCE((
      SELECT jsonb_agg(row_to_json(h) ORDER BY h.hour)
      FROM (
        SELECT gs.hour AS hour, COALESCE(c.n, 0) AS scans
        FROM generate_series(0, 23) AS gs(hour)
        LEFT JOIN (
          SELECT EXTRACT(hour FROM scanned_at AT TIME ZONE 'America/Mexico_City')::int AS hour, count(*) AS n
          FROM qr_scans WHERE campaign_slug = p_slug GROUP BY 1
        ) c ON c.hour = gs.hour
      ) h
    ), '[]'::jsonb),

    'by_device',  public._qr_breakdown(p_slug, 'device_type'),
    'by_browser', public._qr_breakdown(p_slug, 'browser'),
    'by_os',      public._qr_breakdown(p_slug, 'os'),
    'by_country', public._qr_breakdown(p_slug, 'country'),
    'by_city',    public._qr_breakdown(p_slug, 'city'),

    'recent', COALESCE((
      SELECT jsonb_agg(row_to_json(r))
      FROM (
        SELECT scanned_at,
               COALESCE(device_type, 'N/D') AS device_type,
               COALESCE(browser, 'N/D')     AS browser,
               COALESCE(os, 'N/D')          AS os,
               COALESCE(country, 'N/D')     AS country,
               COALESCE(city, 'N/D')        AS city
        FROM qr_scans WHERE campaign_slug = p_slug
        ORDER BY scanned_at DESC LIMIT 25
      ) r
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- Helper: desglose top-10 por una columna (COALESCE a 'N/D'), ignora vacíos.
CREATE OR REPLACE FUNCTION public._qr_breakdown(p_slug text, p_col text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v jsonb;
BEGIN
  EXECUTE format(
    $q$
      SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.n DESC), '[]'::jsonb)
      FROM (
        SELECT COALESCE(NULLIF(trim(%1$I), ''), 'N/D') AS k, count(*) AS n
        FROM qr_scans WHERE campaign_slug = $1
        GROUP BY 1 ORDER BY n DESC LIMIT 10
      ) t
    $q$, p_col)
  INTO v USING p_slug;
  RETURN v;
END;
$function$;

REVOKE ALL ON FUNCTION public._qr_breakdown(text, text) FROM PUBLIC, anon, authenticated;
