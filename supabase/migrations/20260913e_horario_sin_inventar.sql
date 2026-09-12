-- =====================================================================
-- Horario de atención sin valores inventados
-- 13-sep-2026 · medical-masters.com (proyecto ouawwfqexfwuptlgoksr)
--
-- Qué pasaba: doctor_profiles.office_* traía un horario DE FÁBRICA (lunes a
-- viernes 08:00–20:00) para cualquier médico, lo hubiera configurado o no. La
-- migración 20260912 copió ese horario antiguo a doctor_schedule_ranges, y la
-- Agenda lo pintó como «Disponible» en días que nadie configuró. Además
-- get_doctor_schedule, si un médico no tenía rangos, volvía a leer el horario de
-- fábrica, y sync_office_summary nunca vaciaba el resumen antiguo.
--
-- Qué hace (ADITIVA en lógica, IDEMPOTENTE, sin tocar horarios elegidos):
--   1. sync_office_summary: sin semana definida, el resumen antiguo queda vacío.
--   2. get_doctor_schedule: solo devuelve lo que el médico guardó (sin «legacy»).
--   3. office_* sin valor por defecto: un médico nuevo nace SIN horario.
--   4. Borra los rangos inventados que sembró 20260912 y nadie editó:
--        · el patrón de fábrica completo (lunes a viernes 08:00–20:00)
--        · el lunes 08:00–20:00 de la cuenta de pruebas «Demo Prueba QA»
--      Solo filas sembradas el 12-sep a las 12:41 UTC y nunca editadas: lo que un
--      médico guarde en el editor después NO se toca.
--   5. Red de seguridad: quien se queda sin semana no conserva office_* antiguo.
-- =====================================================================

BEGIN;

-- 1. ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_office_summary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doctor uuid := COALESCE(NEW.doctor_id, OLD.doctor_id);
  v_days text[];
  v_start time;
  v_end time;
BEGIN
  SELECT array_agg(DISTINCT (ARRAY['sunday','monday','tuesday','wednesday','thursday','friday','saturday'])[r.weekday + 1]),
         min(r.start_time), max(r.end_time)
    INTO v_days, v_start, v_end
    FROM public.doctor_schedule_ranges r
   WHERE r.doctor_id = v_doctor AND r.weekday IS NOT NULL AND r.is_active;

  IF v_days IS NOT NULL THEN
    UPDATE public.doctor_profiles
       SET office_days = v_days,
           office_hours_start = v_start,
           office_hours_end = v_end
     WHERE user_id = v_doctor
       AND (office_days IS DISTINCT FROM v_days
         OR office_hours_start IS DISTINCT FROM v_start
         OR office_hours_end IS DISTINCT FROM v_end);
  ELSE
    -- Sin semana definida el médico NO tiene horario semanal: nada de valores de fábrica.
    UPDATE public.doctor_profiles
       SET office_days = NULL,
           office_hours_start = NULL,
           office_hours_end = NULL
     WHERE user_id = v_doctor
       AND (office_days IS NOT NULL OR office_hours_start IS NOT NULL OR office_hours_end IS NOT NULL);
  END IF;
  RETURN NULL;
END;
$$;

-- 2. ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_doctor_schedule(
  p_doctor_id uuid,
  p_from date,
  p_to date
)
RETURNS TABLE(day date, start_time time, end_time time, source text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT p_from AS d0, LEAST(p_to, p_from + 370) AS d1
  ),
  days AS (
    SELECT gs::date AS d
      FROM bounds, generate_series(bounds.d0, bounds.d1, interval '1 day') AS gs
     WHERE bounds.d1 >= bounds.d0
  ),
  dated AS (
    SELECT DISTINCT d.d
      FROM days d
      JOIN public.doctor_schedule_ranges r
        ON r.doctor_id = p_doctor_id AND r.specific_date = d.d
  )
  SELECT d.d, r.start_time, r.end_time, 'date'::text
    FROM days d
    JOIN public.doctor_schedule_ranges r
      ON r.doctor_id = p_doctor_id AND r.specific_date = d.d AND r.is_active
  UNION ALL
  SELECT d.d, r.start_time, r.end_time, 'weekday'::text
    FROM days d
    JOIN public.doctor_schedule_ranges r
      ON r.doctor_id = p_doctor_id
     AND r.weekday = EXTRACT(DOW FROM d.d)::smallint
     AND r.is_active
   WHERE NOT EXISTS (SELECT 1 FROM dated x WHERE x.d = d.d)
  ORDER BY 1, 2;
$$;

-- 3. ------------------------------------------------------------------
ALTER TABLE public.doctor_profiles ALTER COLUMN office_days DROP DEFAULT;
ALTER TABLE public.doctor_profiles ALTER COLUMN office_hours_start DROP DEFAULT;
ALTER TABLE public.doctor_profiles ALTER COLUMN office_hours_end DROP DEFAULT;

-- 4. ------------------------------------------------------------------
DELETE FROM public.doctor_schedule_ranges r
 WHERE r.updated_at = r.created_at
   AND r.created_at >= timestamptz '2026-09-12 12:41:00+00'
   AND r.created_at <  timestamptz '2026-09-12 12:42:00+00'
   AND (
     r.doctor_id IN (
       SELECT x.doctor_id
         FROM public.doctor_schedule_ranges x
        GROUP BY x.doctor_id
       HAVING count(*) = 5
          AND count(DISTINCT x.weekday) = 5
          AND bool_and(x.specific_date IS NULL
                       AND x.weekday BETWEEN 1 AND 5
                       AND x.start_time = time '08:00'
                       AND x.end_time = time '20:00')
     )
     OR (r.doctor_id = 'd97cbc20-a605-470f-bef9-9b8b9d0fe6b1'::uuid   -- Demo Prueba QA
         AND r.weekday = 1 AND r.specific_date IS NULL
         AND r.start_time = time '08:00' AND r.end_time = time '20:00')
   );

-- 5. ------------------------------------------------------------------
UPDATE public.doctor_profiles dp
   SET office_days = NULL,
       office_hours_start = NULL,
       office_hours_end = NULL
 WHERE NOT EXISTS (
         SELECT 1 FROM public.doctor_schedule_ranges r
          WHERE r.doctor_id = dp.user_id AND r.weekday IS NOT NULL AND r.is_active)
   AND (dp.office_days IS NOT NULL OR dp.office_hours_start IS NOT NULL OR dp.office_hours_end IS NOT NULL);

COMMIT;

NOTIFY pgrst, 'reload schema';
