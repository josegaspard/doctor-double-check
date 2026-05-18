-- file_access_log: trazabilidad de accesos a contenido protegido (PDFs, imágenes, videos)
-- Permite identificar qué usuario abrió cuál archivo en caso de filtración (watermark + log = atribución)

CREATE TABLE IF NOT EXISTS public.file_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  file_id text NOT NULL,
  bucket text,
  file_type text,
  action text NOT NULL DEFAULT 'viewed', -- viewed | access_denied | download_attempt
  user_agent text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_file_access_log_user_id ON public.file_access_log(user_id);
CREATE INDEX IF NOT EXISTS idx_file_access_log_file_id ON public.file_access_log(file_id);
CREATE INDEX IF NOT EXISTS idx_file_access_log_created_at ON public.file_access_log(created_at DESC);

ALTER TABLE public.file_access_log ENABLE ROW LEVEL SECURITY;

-- Usuarios autenticados pueden insertar SU PROPIO log (audita sus propios accesos)
DROP POLICY IF EXISTS "users insert own access log" ON public.file_access_log;
CREATE POLICY "users insert own access log"
  ON public.file_access_log
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Solo admins pueden leer (privacy)
DROP POLICY IF EXISTS "admins read access log" ON public.file_access_log;
CREATE POLICY "admins read access log"
  ON public.file_access_log
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- service_role lee todo (para queries forenses backend)
GRANT INSERT, SELECT ON public.file_access_log TO authenticated;
GRANT ALL ON public.file_access_log TO service_role;

COMMENT ON TABLE public.file_access_log IS
'Audit log of file views. Combined with dynamic watermark, enables forensic attribution of leaked content.';
