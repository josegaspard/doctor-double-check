
-- 1. Disclaimer acceptances
CREATE TABLE public.disclaimer_acceptances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  disclaimer_key TEXT NOT NULL,
  disclaimer_version TEXT NOT NULL DEFAULT 'v1',
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  context JSONB DEFAULT '{}'::jsonb,
  UNIQUE(user_id, disclaimer_key, disclaimer_version)
);

ALTER TABLE public.disclaimer_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own disclaimer acceptances"
  ON public.disclaimer_acceptances FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own disclaimer acceptances"
  ON public.disclaimer_acceptances FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_disclaimer_acceptances_user ON public.disclaimer_acceptances(user_id, disclaimer_key);

-- 2. Seed editable texts in site_settings (admin can edit later)
INSERT INTO public.site_settings (id, value)
VALUES (
  'disclaimer_orientacion_medica',
  jsonb_build_object(
    'version', 'v1',
    'enabled', true,
    'long', E'**Aviso importante sobre la orientación médica**\n\nLa información, opiniones y recomendaciones que recibas a través de Medical Masters constituyen una **orientación médica** brindada por profesionales de la salud certificados, y **no sustituyen una consulta presencial**, un diagnóstico clínico formal ni la atención médica de urgencia.\n\nAl continuar aceptas que:\n\n• La orientación recibida no establece una relación médico-paciente tradicional ni reemplaza el seguimiento de tu médico tratante.\n• Ante cualquier urgencia (dolor en el pecho, dificultad para respirar, sangrado activo, pérdida de conciencia, ideas de daño a ti mismo o a otros) debes acudir **inmediatamente** al servicio de emergencias más cercano o llamar al **911**.\n• Las recetas, estudios o tratamientos sugeridos a distancia son orientativos y deben validarse con un profesional que pueda explorarte físicamente cuando aplique.\n• Tus datos clínicos se manejan bajo confidencialidad conforme a la normativa mexicana vigente (NOM-004-SSA3-2012 y Ley Federal de Protección de Datos Personales).\n\nAl marcar **Aceptar** confirmas que leíste y comprendes este aviso.',
    'short', '⚠️ Esta es una orientación médica, no sustituye una consulta presencial ni la atención de urgencias. En emergencias llama al 911.'
  )
)
ON CONFLICT (id) DO NOTHING;

-- 3. Performance indexes (diagnosis revealed missing indexes)
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created
  ON public.chat_messages(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_live_chat_messages_live_created
  ON public.live_chat_messages(live_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_consultations_doctor_status
  ON public.consultations(doctor_id, status);

CREATE INDEX IF NOT EXISTS idx_consultations_patient_status
  ON public.consultations(patient_id, status);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_created
  ON public.wallet_transactions(user_id, created_at DESC);
