-- Infra de fondos virtuales de lives (cliente 15-jul-2026). Dos fixes de
-- backend que el frontend ya asume:
--
-- (1) El gestor admin sube IMÁGENES al bucket 'site-videos', pero su
--     allowed_mime_types era solo de video → los uploads de fondo fallaban.
--     Ampliamos para aceptar también jpg/png/webp (sin quitar los de video).
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'video/mp4','video/webm','video/quicktime','video/ogg',
  'image/jpeg','image/png','image/webp'
]
WHERE id = 'site-videos';

-- (2) useLiveBackgrounds lee site_settings id='live_backgrounds', pero la
--     policy pública de lectura tenía una allowlist que NO lo incluía → los
--     doctores no-admin no veían los fondos. Recreamos la policy con la MISMA
--     lista viva de prod + 'live_backgrounds' (la fila solo tiene pares
--     label + URL de bucket público → lectura pública sin exposición sensible).
DROP POLICY IF EXISTS "Public can read public settings" ON public.site_settings;
CREATE POLICY "Public can read public settings"
  ON public.site_settings FOR SELECT
  USING (id = ANY (ARRAY[
    'social_links','terms_of_service','privacy_policy','contact_info',
    'storage_pricing','feature_toggles','subscription_pricing','landing_stats',
    'app_config','extra_specialties','text_overrides','email_branding',
    'live_backgrounds'
  ]));
