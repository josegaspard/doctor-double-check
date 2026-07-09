-- Auditoría 2026-07-09 — índices de performance + endurecimientos menores de seguridad.

-- 1) Índices faltantes en tablas que la RLS filtra en CADA query (antes: seq scan
--    + evaluación de política fila por fila; escala mal con el crecimiento).
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor ON public.prescriptions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON public.prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_purchases_user ON public.purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_entitlements_user ON public.entitlements(user_id);
-- Consulta caliente del paywall de chat (user_id + type + is_active).
CREATE INDEX IF NOT EXISTS idx_entitlements_user_type_active
  ON public.entitlements(user_id, type) WHERE is_active = true;

-- 2) update_doctor_rating(): SECURITY DEFINER sin search_path fijo (convención del
--    resto del código; evita search-path injection). Solo fija el search_path.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'update_doctor_rating'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.update_doctor_rating() SET search_path = public';
  END IF;
END $$;

-- 3) Política INSERT de wallets: forzar balance inicial 0 (antes el WITH CHECK solo
--    validaba user_id → en teoría un usuario podía insertar su wallet con saldo alto;
--    mitigado por UNIQUE(user_id)+trigger, pero cerramos el hueco de forma explícita).
DROP POLICY IF EXISTS "Users can insert own wallet" ON public.wallets;
CREATE POLICY "Users can insert own wallet" ON public.wallets
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND COALESCE(balance, 0) = 0);
