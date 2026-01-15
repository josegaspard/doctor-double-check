-- =============================================
-- 1. SISTEMA DE IDIOMA (i18n)
-- =============================================

-- Crear enum para idiomas soportados
CREATE TYPE public.supported_language AS ENUM ('es', 'en');

-- Agregar preferencia de idioma a perfiles
ALTER TABLE public.profiles 
ADD COLUMN preferred_language public.supported_language NOT NULL DEFAULT 'es';

-- =============================================
-- 2. CLASIFICACIÓN DE CONTENIDO DEL DOCTOR
-- =============================================

-- Crear enum para tipo de audiencia
CREATE TYPE public.content_audience AS ENUM ('all', 'patients', 'professionals');

-- Agregar clasificación de audiencia a doctor_content
ALTER TABLE public.doctor_content 
ADD COLUMN audience_type public.content_audience NOT NULL DEFAULT 'all';

-- Actualizar política de contenido público para filtrar por audiencia
DROP POLICY IF EXISTS "Public content is viewable by everyone" ON public.doctor_content;

CREATE POLICY "Public content filtered by audience" 
ON public.doctor_content FOR SELECT
USING (
  is_public = true AND (
    -- Everyone can see 'all' content
    audience_type = 'all' OR
    -- Patients can see patient content
    (audience_type = 'patients' AND (
      has_role(auth.uid(), 'patient') OR 
      has_role(auth.uid(), 'doctor') OR 
      has_role(auth.uid(), 'resident') OR
      has_role(auth.uid(), 'admin')
    )) OR
    -- Only professionals can see professional content
    (audience_type = 'professionals' AND (
      has_role(auth.uid(), 'doctor') OR 
      has_role(auth.uid(), 'resident') OR
      has_role(auth.uid(), 'admin')
    ))
  )
);

-- =============================================
-- 3. SISTEMA DE SUSCRIPCIONES MEJORADO
-- =============================================

-- Crear enum para tipos de suscripción
CREATE TYPE public.subscription_tier AS ENUM ('free', 'basic', 'premium');

-- Agregar campos a subscriptions existente
ALTER TABLE public.subscriptions 
ADD COLUMN tier public.subscription_tier NOT NULL DEFAULT 'free',
ADD COLUMN notify_on_live boolean NOT NULL DEFAULT true,
ADD COLUMN notify_on_content boolean NOT NULL DEFAULT true,
ADD COLUMN notify_on_availability boolean NOT NULL DEFAULT true;

-- =============================================
-- 4. SISTEMA DE NOTIFICACIONES
-- =============================================

-- Crear enum para tipos de notificación
CREATE TYPE public.notification_type AS ENUM (
  'doctor_live', 
  'doctor_availability', 
  'new_content', 
  'subscription_update',
  'chat_message',
  'system'
);

-- Crear tabla de notificaciones
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type public.notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Políticas para notificaciones
CREATE POLICY "Users can view own notifications" 
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" 
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications" 
ON public.notifications FOR DELETE
USING (auth.uid() = user_id);

-- Política para que el sistema pueda crear notificaciones (via service role)
CREATE POLICY "System can create notifications" 
ON public.notifications FOR INSERT
WITH CHECK (true);

-- Índices para rendimiento
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id, is_read) WHERE is_read = false;

-- =============================================
-- 5. DISPONIBILIDAD/HORARIOS DEL DOCTOR
-- =============================================

-- Crear enum para estado de disponibilidad
CREATE TYPE public.availability_status AS ENUM ('scheduled', 'confirmed', 'cancelled', 'completed');

-- Tabla para horarios de disponibilidad del doctor
CREATE TABLE public.doctor_availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  type TEXT NOT NULL DEFAULT 'live', -- 'live', 'consultation', 'office_hours'
  status public.availability_status NOT NULL DEFAULT 'scheduled',
  notifications_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.doctor_availability ENABLE ROW LEVEL SECURITY;

-- Políticas para disponibilidad
CREATE POLICY "Anyone can view confirmed availability" 
ON public.doctor_availability FOR SELECT
USING (status IN ('scheduled', 'confirmed'));

CREATE POLICY "Doctors can manage own availability" 
ON public.doctor_availability FOR ALL
USING (auth.uid() = doctor_id);

-- Trigger para updated_at
CREATE TRIGGER update_doctor_availability_updated_at
  BEFORE UPDATE ON public.doctor_availability
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índice para búsquedas por fecha
CREATE INDEX idx_doctor_availability_scheduled ON public.doctor_availability(scheduled_at);
CREATE INDEX idx_doctor_availability_doctor ON public.doctor_availability(doctor_id);

-- =============================================
-- 6. PREFERENCIAS DE NOTIFICACIÓN DEL USUARIO
-- =============================================

CREATE TABLE public.notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  email_notifications BOOLEAN NOT NULL DEFAULT true,
  push_notifications BOOLEAN NOT NULL DEFAULT true,
  in_app_notifications BOOLEAN NOT NULL DEFAULT true,
  notify_doctor_live BOOLEAN NOT NULL DEFAULT true,
  notify_new_content BOOLEAN NOT NULL DEFAULT true,
  notify_chat_messages BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Users can view own preferences" 
ON public.notification_preferences FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own preferences" 
ON public.notification_preferences FOR ALL
USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 7. VERIFICACIÓN DE IDENTIDAD
-- =============================================

-- Crear enum para estado de verificación
CREATE TYPE public.identity_verification_status AS ENUM ('pending', 'in_progress', 'verified', 'failed', 'expired');

-- Tabla para tracking de verificación de identidad
CREATE TABLE public.identity_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL DEFAULT 'manual', -- 'stripe_identity', 'veriff', 'jumio', 'manual'
  external_id TEXT, -- ID del proveedor externo
  status public.identity_verification_status NOT NULL DEFAULT 'pending',
  verified_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.identity_verifications ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Users can view own verifications" 
ON public.identity_verifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage verifications" 
ON public.identity_verifications FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Agregar campo de verificación a profiles
ALTER TABLE public.profiles 
ADD COLUMN is_identity_verified BOOLEAN NOT NULL DEFAULT false;

-- Trigger para updated_at
CREATE TRIGGER update_identity_verifications_updated_at
  BEFORE UPDATE ON public.identity_verifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 8. FUNCIÓN PARA CREAR NOTIFICACIONES A SUSCRIPTORES
-- =============================================

CREATE OR REPLACE FUNCTION public.notify_subscribers(
  p_doctor_id UUID,
  p_notification_type public.notification_type,
  p_title TEXT,
  p_message TEXT,
  p_data JSONB DEFAULT '{}'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- Insertar notificaciones para todos los suscriptores activos del doctor
  INSERT INTO public.notifications (user_id, type, title, message, data)
  SELECT 
    s.subscriber_id,
    p_notification_type,
    p_title,
    p_message,
    p_data
  FROM public.subscriptions s
  WHERE s.creator_id = p_doctor_id
    AND s.is_active = true
    AND (
      (p_notification_type = 'doctor_live' AND s.notify_on_live = true) OR
      (p_notification_type = 'new_content' AND s.notify_on_content = true) OR
      (p_notification_type = 'doctor_availability' AND s.notify_on_availability = true) OR
      p_notification_type NOT IN ('doctor_live', 'new_content', 'doctor_availability')
    );
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Habilitar realtime para notificaciones
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;