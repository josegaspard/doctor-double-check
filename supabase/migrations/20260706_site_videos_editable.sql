-- Videos editables desde el súper admin: home landing + 3 tutoriales por rol.
-- Bucket público 'site-videos' (solo admin escribe, todos leen) + fila site_settings 'videos'.

-- 1) Bucket público para videos del sitio (hasta 300MB, solo formatos de video)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'site-videos', 'site-videos', true, 314572800,
  ARRAY['video/mp4','video/webm','video/quicktime','video/ogg']
)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2) Policies de storage.objects para el bucket
DROP POLICY IF EXISTS "site-videos public read"   ON storage.objects;
DROP POLICY IF EXISTS "site-videos admin insert"   ON storage.objects;
DROP POLICY IF EXISTS "site-videos admin update"   ON storage.objects;
DROP POLICY IF EXISTS "site-videos admin delete"   ON storage.objects;

CREATE POLICY "site-videos public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'site-videos');

CREATE POLICY "site-videos admin insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'site-videos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "site-videos admin update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'site-videos' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'site-videos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "site-videos admin delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'site-videos' AND public.has_role(auth.uid(), 'admin'));

-- 3) Fila de configuración: URLs de los 4 videos. Home apunta al asset estático
--    por defecto (sin cambio visual); los tutoriales quedan null (muestran "muy pronto").
INSERT INTO public.site_settings (id, value)
VALUES (
  'videos',
  jsonb_build_object(
    'home', '/landing-mm-2026.mp4',
    'tutorial_doctor', NULL,
    'tutorial_patient', NULL,
    'tutorial_resident', NULL
  )
)
ON CONFLICT (id) DO NOTHING;
