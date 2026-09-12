-- =====================================================================
-- F2 · Planes de suscripción con nombre propio por médico
-- 13-sep-2026 · medical-masters.com (proyecto ouawwfqexfwuptlgoksr)
--
-- Migración ADITIVA e IDEMPOTENTE: se puede correr varias veces.
-- No borra ni reescribe ningún dato. No inserta planes: la tabla nace vacía
-- y cada médico crea los suyos desde Cuenta › Perfil › Contenido y monetización.
--
-- El modelo de niveles NO cambia: sigue habiendo dos niveles de pago
-- (basic / premium). Cada médico puede personalizar SUS dos niveles
-- (nombre, descripción, precio mensual y ventajas). Si un nivel no tiene
-- plan activo, todo sigue como hoy: nombre «Básico/Premium» y precio global
-- de site_settings.subscription_pricing.
--
-- Quién lo lee:
--   · Perfil público y modal de suscripción → RPC get_doctor_subscription_plans
--   · Edge Function create-subscription-checkout → SELECT con la clave anon
--     (policy de lectura pública de los planes activos)
--   · Editor del médico → SELECT / UPSERT directos con RLS de dueño
--
-- Bloques:
--   1. Tabla doctor_subscription_plans + validaciones
--   2. RLS
--   3. RPC get_doctor_subscription_plans
--   4. Permisos y recarga del esquema
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. TABLA
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.doctor_subscription_plans (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier         text NOT NULL,                 -- 'basic' | 'premium'
  name         text NOT NULL,                 -- 3-60 caracteres
  description  text,                          -- hasta 280 caracteres
  price_cents  integer NOT NULL,              -- MXN en centavos: 1000 ($10) … 500000 ($5,000)
  perks        text[] NOT NULL DEFAULT '{}',  -- hasta 6 ventajas de 1-80 caracteres
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Ventajas válidas: como mucho 6, ninguna vacía ni de más de 80 caracteres.
-- Función pura (IMMUTABLE) para poder usarla en un CHECK.
CREATE OR REPLACE FUNCTION public.doctor_plan_perks_valid(p_perks text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(cardinality(p_perks), 0) <= 6
     AND NOT EXISTS (
       SELECT 1
         FROM unnest(COALESCE(p_perks, ARRAY[]::text[])) AS x(v)
        WHERE v IS NULL OR char_length(btrim(v)) = 0 OR char_length(v) > 80
     );
$$;

DO $$
DECLARE
  v_rel oid := 'public.doctor_subscription_plans'::regclass;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = v_rel AND conname = 'doctor_subscription_plans_tier_check') THEN
    ALTER TABLE public.doctor_subscription_plans
      ADD CONSTRAINT doctor_subscription_plans_tier_check CHECK (tier IN ('basic', 'premium'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = v_rel AND conname = 'doctor_subscription_plans_name_check') THEN
    ALTER TABLE public.doctor_subscription_plans
      ADD CONSTRAINT doctor_subscription_plans_name_check CHECK (char_length(btrim(name)) BETWEEN 3 AND 60);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = v_rel AND conname = 'doctor_subscription_plans_description_check') THEN
    ALTER TABLE public.doctor_subscription_plans
      ADD CONSTRAINT doctor_subscription_plans_description_check CHECK (description IS NULL OR char_length(description) <= 280);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = v_rel AND conname = 'doctor_subscription_plans_price_check') THEN
    ALTER TABLE public.doctor_subscription_plans
      ADD CONSTRAINT doctor_subscription_plans_price_check CHECK (price_cents BETWEEN 1000 AND 500000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = v_rel AND conname = 'doctor_subscription_plans_perks_check') THEN
    ALTER TABLE public.doctor_subscription_plans
      ADD CONSTRAINT doctor_subscription_plans_perks_check CHECK (public.doctor_plan_perks_valid(perks));
  END IF;
END $$;

-- Un plan por nivel y médico. Índice único normal (no parcial) para que el
-- UPSERT de PostgREST (on_conflict=doctor_id,tier) pueda inferirlo.
CREATE UNIQUE INDEX IF NOT EXISTS doctor_subscription_plans_doctor_tier_key
  ON public.doctor_subscription_plans (doctor_id, tier);

DROP TRIGGER IF EXISTS trg_dsp_updated_at ON public.doctor_subscription_plans;
CREATE TRIGGER trg_dsp_updated_at
  BEFORE UPDATE ON public.doctor_subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- 2. RLS
--    · Lectura pública: solo los planes activos (lo que ve el perfil y lo
--      que lee la función de cobro con la clave anon).
--    · El médico gestiona los suyos (y ve también los desactivados).
--      Para crear o modificar hace falta el rol de médico.
--    · El admin, todo.
-- =====================================================================

ALTER TABLE public.doctor_subscription_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dsp_public_read ON public.doctor_subscription_plans;
CREATE POLICY dsp_public_read ON public.doctor_subscription_plans
  FOR SELECT USING (is_active);

DROP POLICY IF EXISTS dsp_owner_all ON public.doctor_subscription_plans;
CREATE POLICY dsp_owner_all ON public.doctor_subscription_plans
  FOR ALL USING (doctor_id = (SELECT auth.uid()))
  WITH CHECK (
    doctor_id = (SELECT auth.uid())
    AND public.has_role((SELECT auth.uid()), 'doctor')
  );

DROP POLICY IF EXISTS dsp_admin_all ON public.doctor_subscription_plans;
CREATE POLICY dsp_admin_all ON public.doctor_subscription_plans
  FOR ALL USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

-- =====================================================================
-- 3. RPC · planes activos de un médico (perfil público y modal de pago)
--    Devuelve 0, 1 o 2 filas (basic primero). Sin fila para un nivel →
--    el frontend usa el nombre y el precio globales de hoy.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_doctor_subscription_plans(p_doctor_id uuid)
RETURNS TABLE(
  id          uuid,
  tier        text,
  name        text,
  description text,
  price_cents integer,
  perks       text[],
  updated_at  timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.tier, p.name, p.description, p.price_cents, p.perks, p.updated_at
    FROM public.doctor_subscription_plans p
   WHERE p.doctor_id = p_doctor_id
     AND p.is_active
   ORDER BY CASE p.tier WHEN 'basic' THEN 0 ELSE 1 END;
$$;

-- =====================================================================
-- 4. PERMISOS
-- =====================================================================

GRANT SELECT ON public.doctor_subscription_plans TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.doctor_subscription_plans TO authenticated;

REVOKE ALL ON FUNCTION public.get_doctor_subscription_plans(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_doctor_subscription_plans(uuid) TO anon, authenticated;

-- La usa el CHECK de la tabla: quien inserta o actualiza necesita poder ejecutarla.
GRANT EXECUTE ON FUNCTION public.doctor_plan_perks_valid(text[]) TO anon, authenticated;

COMMIT;

-- PostgREST tiene que ver los objetos nuevos en su caché de esquema.
NOTIFY pgrst, 'reload schema';
