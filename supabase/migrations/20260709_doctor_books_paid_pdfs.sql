-- Libros/cursos PDF de pago en el perfil del doctor (cliente 2026-07-08).
-- Reutiliza doctor_content (type='pdf', price ya existía) + purchases.content_id.
-- is_book separa los libros del resto del contenido; original_price es el
-- precio "antes" tachado en la tarjeta (estilo tienda de la referencia).

ALTER TABLE public.doctor_content
  ADD COLUMN IF NOT EXISTS is_book boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS original_price numeric;

CREATE INDEX IF NOT EXISTS idx_doctor_content_books
  ON public.doctor_content(creator_id, created_at DESC) WHERE is_book;

-- Una compra por usuario por contenido. El UNIQUE original de purchases solo
-- cubre (user_id, recording_id); sin esto un doble webhook/doble click podría
-- duplicar la compra de un libro.
CREATE UNIQUE INDEX IF NOT EXISTS purchases_user_content_unique
  ON public.purchases(user_id, content_id) WHERE content_id IS NOT NULL;

-- Storage: el comprador de un contenido de pago puede leer el archivo
-- (createSignedUrl del cliente pasa por esta RLS). Además se cierra el hueco
-- que dejaba a cualquier doctor leer contenido público DE PAGO cuando es un
-- libro (los libros solo se descargan comprados, salvo creador/admin).
DROP POLICY IF EXISTS "doctor-content restricted read" ON storage.objects;
CREATE POLICY "doctor-content restricted read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'doctor-content'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.doctor_content dc
      WHERE storage.filename(dc.file_url) = storage.filename(storage.objects.name)
        AND (
          (dc.is_public = true AND (dc.price IS NULL OR dc.price = 0))
          OR dc.creator_id = auth.uid()
          OR (dc.is_public = true AND dc.is_book = false AND (public.has_role(auth.uid(), 'doctor'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role)))
          OR EXISTS (
            SELECT 1 FROM public.purchases pu
            WHERE pu.user_id = auth.uid() AND pu.content_id = dc.id
          )
        )
    )
  )
);
