-- =====================================================================
-- Servicios y precios del médico (paquete F1 «servicios»)
-- 13-sep-2026 · medical-masters.com (proyecto ouawwfqexfwuptlgoksr)
--
-- Migración ADITIVA e IDEMPOTENTE: se puede correr varias veces.
-- No borra ni reescribe ningún dato real y NO inserta servicios de ejemplo:
-- cada médico crea los suyos desde Cuenta › Perfil › Servicios.
--
-- Bloques:
--   1. Tabla doctor_services (CHECKs, índices, RLS, trigger updated_at)
--   2. Lectura pública: get_doctor_services(p_doctor_id)
--   3. Foto del servicio en la cita: appointments.service_id / service_name / price
--      + trigger que rellena la foto desde el servicio REAL (el navegador no
--        puede escribir un precio a mano)
--   4. Permisos y recarga del esquema
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. SERVICIOS DEL MÉDICO
--    Mientras un médico no tenga ningún servicio activo, su perfil público
--    sigue enseñando la fila única de hoy con doctor_profiles.consultation_fee.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.doctor_services (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name             text NOT NULL,
  description      text,
  duration_minutes integer NOT NULL DEFAULT 30,
  price            numeric(10,2) NOT NULL DEFAULT 0,        -- MXN
  modality         text NOT NULL DEFAULT 'online',          -- online | presencial | ambas
  icon             text NOT NULL DEFAULT 'stethoscope',     -- video | user | file | stethoscope | heart | clipboard
  sort_order       integer NOT NULL DEFAULT 0,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Mismos límites que valida el editor (src/hooks/useDoctorServices.ts · SERVICE_LIMITS).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'doctor_services_name_check') THEN
    ALTER TABLE public.doctor_services
      ADD CONSTRAINT doctor_services_name_check CHECK (char_length(btrim(name)) BETWEEN 2 AND 80);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'doctor_services_description_check') THEN
    ALTER TABLE public.doctor_services
      ADD CONSTRAINT doctor_services_description_check CHECK (description IS NULL OR char_length(description) <= 200);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'doctor_services_duration_check') THEN
    ALTER TABLE public.doctor_services
      ADD CONSTRAINT doctor_services_duration_check CHECK (duration_minutes BETWEEN 10 AND 240);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'doctor_services_price_check') THEN
    ALTER TABLE public.doctor_services
      ADD CONSTRAINT doctor_services_price_check CHECK (price >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'doctor_services_modality_check') THEN
    ALTER TABLE public.doctor_services
      ADD CONSTRAINT doctor_services_modality_check CHECK (modality IN ('online','presencial','ambas'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'doctor_services_icon_check') THEN
    ALTER TABLE public.doctor_services
      ADD CONSTRAINT doctor_services_icon_check
      CHECK (icon IN ('video','user','file','stethoscope','heart','clipboard'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS doctor_services_doctor_idx
  ON public.doctor_services (doctor_id, sort_order, created_at);
CREATE INDEX IF NOT EXISTS doctor_services_active_idx
  ON public.doctor_services (doctor_id, sort_order) WHERE is_active;

ALTER TABLE public.doctor_services ENABLE ROW LEVEL SECURITY;

-- Lectura pública: solo los servicios ACTIVOS de médicos APROBADOS.
-- is_approved_doctor es SECURITY DEFINER (doctor_profiles no es legible por anon).
DROP POLICY IF EXISTS doctor_services_public_read ON public.doctor_services;
CREATE POLICY doctor_services_public_read ON public.doctor_services
  FOR SELECT USING (is_active AND public.is_approved_doctor(doctor_id));

-- El médico gestiona los suyos (también en revisión, para dejarlos listos).
DROP POLICY IF EXISTS doctor_services_owner_all ON public.doctor_services;
CREATE POLICY doctor_services_owner_all ON public.doctor_services
  FOR ALL USING (doctor_id = (SELECT auth.uid()))
  WITH CHECK (
    doctor_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.doctor_profiles dp WHERE dp.user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS doctor_services_admin_all ON public.doctor_services;
CREATE POLICY doctor_services_admin_all ON public.doctor_services
  FOR ALL USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

DROP TRIGGER IF EXISTS trg_doctor_services_updated_at ON public.doctor_services;
CREATE TRIGGER trg_doctor_services_updated_at
  BEFORE UPDATE ON public.doctor_services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- 2. LECTURA PÚBLICA (perfil público y reserva; anon y authenticated)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_doctor_services(p_doctor_id uuid)
RETURNS TABLE(
  id uuid,
  doctor_id uuid,
  name text,
  description text,
  duration_minutes integer,
  price numeric,
  modality text,
  icon text,
  sort_order integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.doctor_id, s.name, s.description, s.duration_minutes, s.price,
         s.modality, s.icon, s.sort_order
    FROM public.doctor_services s
   WHERE s.doctor_id = p_doctor_id
     AND s.is_active
     AND public.is_approved_doctor(p_doctor_id)
   ORDER BY s.sort_order, s.created_at;
$$;

-- =====================================================================
-- 3. FOTO DEL SERVICIO EN LA CITA
--    Al reservar se guarda qué servicio era, cómo se llamaba y cuánto costaba.
--    Si el médico borra el servicio después, la cita conserva nombre y precio
--    (service_id pasa a NULL).
-- =====================================================================

ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS service_id uuid;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS service_name text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS price numeric;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_service_id_fkey') THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_service_id_fkey
      FOREIGN KEY (service_id) REFERENCES public.doctor_services(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_price_check') THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_price_check CHECK (price IS NULL OR price >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_appointments_service
  ON public.appointments (service_id) WHERE service_id IS NOT NULL;

-- La política de INSERT de appointments solo comprueba patient_id: sin este
-- trigger un paciente podría mandar el servicio de otro médico o un precio
-- inventado. La foto se copia SIEMPRE del servicio real.
CREATE OR REPLACE FUNCTION public.appointments_service_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service public.doctor_services%ROWTYPE;
BEGIN
  -- Actualizaciones: la foto no se reescribe a mano. Si el servicio no cambia
  -- (o pasa a NULL porque se borró), se conserva la que ya tenía la cita.
  IF TG_OP = 'UPDATE' THEN
    IF NEW.service_id IS NULL OR NEW.service_id IS NOT DISTINCT FROM OLD.service_id THEN
      NEW.service_name := OLD.service_name;
      NEW.price := OLD.price;
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.service_id IS NULL THEN
    -- Reserva sin servicio hecha por el propio paciente: sin precio ni nombre sueltos.
    IF NEW.patient_id = (SELECT auth.uid()) THEN
      NEW.service_name := NULL;
      NEW.price := NULL;
    END IF;
    RETURN NEW;
  END IF;

  SELECT * INTO v_service FROM public.doctor_services s WHERE s.id = NEW.service_id;
  IF NOT FOUND OR v_service.doctor_id <> NEW.doctor_id THEN
    RAISE EXCEPTION 'invalid_service' USING ERRCODE = '23503';
  END IF;
  IF TG_OP = 'INSERT' AND NOT v_service.is_active THEN
    RAISE EXCEPTION 'service_inactive' USING ERRCODE = '22023';
  END IF;

  NEW.service_name := v_service.name;
  NEW.price := v_service.price;
  IF TG_OP = 'INSERT' THEN
    NEW.duration_minutes := v_service.duration_minutes;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_appointments_service_snapshot ON public.appointments;
CREATE TRIGGER trg_appointments_service_snapshot
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.appointments_service_snapshot();

-- =====================================================================
-- 4. PERMISOS
-- =====================================================================

GRANT SELECT ON public.doctor_services TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.doctor_services TO authenticated;

REVOKE ALL ON FUNCTION public.get_doctor_services(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_doctor_services(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.appointments_service_snapshot() FROM PUBLIC, anon, authenticated;

COMMIT;

-- PostgREST tiene que ver los objetos nuevos en su caché de esquema.
NOTIFY pgrst, 'reload schema';
