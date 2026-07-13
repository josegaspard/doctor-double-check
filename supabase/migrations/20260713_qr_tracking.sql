-- QR tracking · conteo de escaneos de códigos QR impresos (invitaciones a médicos).
-- El cliente imprime ~1,000 invitaciones con UN MISMO QR y quiere medir cuántos
-- escanearon y entraron al sitio, SIN identificar a cada persona (solo el conteo).
--
-- Flujo: el QR apunta a /qr?c=<slug> (rewrite de Vercel a la edge function `qr-scan`,
-- verify_jwt=false). La función inserta una fila aquí con el service-role (RLS no la
-- bloquea) y redirige 302 al destino con parámetros UTM para que GA4 también lo capte.
-- El panel de súper admin (/admin/qr) lee el conteo vía la RPC `qr_campaign_stats`.
--
-- Privacidad: NO se guarda PII. `ip_hash` es un SHA-256 truncado de (ip|user-agent)
-- calculado en la función; sirve solo para una estimación aproximada de personas
-- únicas, no permite re-identificar a nadie.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tabla de campañas (metadatos del QR: a dónde redirige y qué UTM usa)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.qr_campaigns (
  slug             text PRIMARY KEY,
  name             text NOT NULL,
  destination_path text NOT NULL DEFAULT '/',
  utm_source       text NOT NULL DEFAULT 'invitacion-impresa',
  utm_medium       text NOT NULL DEFAULT 'qr',
  utm_campaign     text NOT NULL DEFAULT 'qr',
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Tabla de escaneos (una fila por escaneo; el conteo vive aquí)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.qr_scans (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  campaign_slug text NOT NULL,
  scanned_at    timestamptz NOT NULL DEFAULT now(),
  user_agent    text,
  referer       text,
  ip_hash       text,           -- sha256(ip|ua) truncado, NO reversible (privacidad)
  country       text
);

CREATE INDEX IF NOT EXISTS qr_scans_campaign_time_idx
  ON public.qr_scans (campaign_slug, scanned_at DESC);
CREATE INDEX IF NOT EXISTS qr_scans_iphash_idx
  ON public.qr_scans (campaign_slug, ip_hash);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RLS: solo admins leen; los inserts los hace la función con service-role
--    (que ignora RLS). anon/authenticated no tienen acceso directo.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.qr_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_scans     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage qr_campaigns" ON public.qr_campaigns;
CREATE POLICY "Admins manage qr_campaigns" ON public.qr_campaigns
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins read qr_scans" ON public.qr_scans;
CREATE POLICY "Admins read qr_scans" ON public.qr_scans
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Blindaje de grants (consistente con el hardening anti-anon de 2026-07-11):
-- nadie fuera de admin (vía RLS) o service-role (vía bypass) toca estas tablas.
REVOKE ALL ON public.qr_campaigns FROM anon;
REVOKE ALL ON public.qr_scans     FROM anon;
GRANT SELECT ON public.qr_campaigns TO authenticated;
GRANT SELECT ON public.qr_scans     TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Semilla: la campaña de las invitaciones impresas a médicos
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.qr_campaigns (slug, name, destination_path, utm_source, utm_medium, utm_campaign)
VALUES (
  'doctores-invitacion-2026',
  'Invitaciones impresas a médicos 2026',
  '/',
  'invitacion-impresa',
  'qr',
  'doctores-2026'
)
ON CONFLICT (slug) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RPC de estadísticas para el panel (SECURITY DEFINER, gateada a admin).
--    Devuelve el conteo total + hoy + 7d + 30d + únicos aprox + serie diaria.
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
        SELECT to_char(gs.day, 'YYYY-MM-DD') AS day,
               COALESCE(c.n, 0) AS scans
        FROM generate_series(
               (date_trunc('day', now() AT TIME ZONE 'America/Mexico_City') - interval '29 days')::date,
               (date_trunc('day', now() AT TIME ZONE 'America/Mexico_City'))::date,
               interval '1 day'
             ) AS gs(day)
        LEFT JOIN (
          SELECT (scanned_at AT TIME ZONE 'America/Mexico_City')::date AS day, count(*) AS n
          FROM qr_scans
          WHERE campaign_slug = p_slug
            AND scanned_at >= now() - interval '30 days'
          GROUP BY 1
        ) c ON c.day = gs.day::date
      ) d
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.qr_campaign_stats(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qr_campaign_stats(text) TO authenticated;
