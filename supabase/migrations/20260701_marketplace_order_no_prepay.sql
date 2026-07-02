-- ============================================================================
-- Marketplace dr↔dr: ORDEN DE COMPRA SIN PREPAGO (cliente 2026-07-01, tarde)
-- ----------------------------------------------------------------------------
-- Cambio de modelo respecto a 20260701_marketplace_intro_fee_flow.sql:
--   * "Estoy interesado" YA NO cobra nada al comprador. Genera una ORDEN DE
--     COMPRA al doctor vendedor y abre el chat de inmediato.
--   * Se notifica TODO (vendedor, comprador y administradores).
--   * Comprador y proveedor negocian por chat. Cuando el vendedor "concreta"
--     la venta (sin método de pago de por medio), la venta queda completada.
--   * El FEE lo paga el VENDEDOR (quien sube el producto) por esa venta
--     concretada: fee_status pending → paid (checkout Stripe del vendedor).
--
-- Idempotente. Las transiciones de estado las hace la edge function
-- `marketplace-order` con service_role; RLS de UPDATE queda solo-admin.
-- ============================================================================

-- 1) Estados nuevos del interés/orden --------------------------------------
ALTER TABLE public.product_interests
  DROP CONSTRAINT IF EXISTS product_interests_status_check;
ALTER TABLE public.product_interests
  ADD CONSTRAINT product_interests_status_check
  CHECK (status IN ('pending_payment','paid','cancelled','expired','ordered','completed'));

-- 2) Fee ahora es del VENDEDOR y se cobra al concretar ----------------------
ALTER TABLE public.product_interests
  ADD COLUMN IF NOT EXISTS fee_status            text NOT NULL DEFAULT 'none'
    CHECK (fee_status IN ('none','pending','paid')),
  ADD COLUMN IF NOT EXISTS completed_at          timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at          timestamptz,
  ADD COLUMN IF NOT EXISTS fee_paid_at           timestamptz,
  ADD COLUMN IF NOT EXISTS fee_stripe_session_id text;

-- 3) Legacy: los intereses del modelo anterior (comprador pagó el fee) se
--    mapean a "venta concretada con fee pagado" para que el panel admin y las
--    métricas queden coherentes.
UPDATE public.product_interests
SET status       = 'completed',
    fee_status   = 'paid',
    completed_at = COALESCE(completed_at, paid_at, created_at),
    fee_paid_at  = COALESCE(fee_paid_at, paid_at, created_at)
WHERE status = 'paid';

-- Órdenes que quedaron a medio pago en el modelo viejo → orden activa nueva
-- (el comprador mostró interés; ya no debe pagar nada).
UPDATE public.product_interests
SET status = 'cancelled', cancelled_at = now()
WHERE status = 'pending_payment';

CREATE INDEX IF NOT EXISTS idx_product_interests_status ON public.product_interests(status);
CREATE INDEX IF NOT EXISTS idx_product_interests_fee    ON public.product_interests(fee_status);

-- ============================================================================
-- FIN. Aplicar por psql al pooler (ver reference_medical_masters_deploy_access).
-- ============================================================================
