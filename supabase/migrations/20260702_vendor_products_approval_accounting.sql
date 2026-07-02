-- ============================================================================
-- 2026-07-02 — Portal de proveedores completo (cliente):
--   1) Productos del marketplace requieren aprobación del SUPER ADMIN antes de
--      ser visibles (approval_status pending/approved/rejected).
--   2) El admin puede mandar notificaciones (campanilla) a cualquier usuario
--      (aprobar/rechazar proveedor o producto notifica al interesado).
--   3) Contabilidad de compras del marketplace de intermediación: cada venta
--      concretada y cada fee cobrado asientan en accounting_ledger
--      (double-entry, mismas cuentas que el resto de la plataforma).
-- Idempotente: se puede correr más de una vez.
-- ============================================================================

-- ── 1) Aprobación de productos ──────────────────────────────────────────────
ALTER TABLE public.marketplace_products
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approval_note text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid;

DO $$ BEGIN
  ALTER TABLE public.marketplace_products
    ADD CONSTRAINT marketplace_products_approval_status_check
    CHECK (approval_status IN ('pending', 'approved', 'rejected'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill: todo lo publicado ANTES de esta migración queda aprobado
-- (cutoff fijo para no auto-aprobar productos nuevos si se re-corre).
UPDATE public.marketplace_products
SET approval_status = 'approved', approved_at = now()
WHERE approval_status = 'pending'
  AND created_at < '2026-07-02T00:00:00Z';

-- RLS: el público solo ve productos activos Y aprobados; el proveedor ve los
-- suyos (cualquier estado) y el admin ve todo.
DROP POLICY IF EXISTS "Public can view active products" ON public.marketplace_products;
DROP POLICY IF EXISTS "marketplace_products_public_read" ON public.marketplace_products;
CREATE POLICY "marketplace_products_public_read" ON public.marketplace_products
  FOR SELECT USING (
    (is_active = true AND approval_status = 'approved')
    OR vendor_id IN (SELECT id FROM public.marketplace_vendors WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE INDEX IF NOT EXISTS idx_marketplace_products_approval
  ON public.marketplace_products (approval_status)
  WHERE approval_status <> 'approved';

-- ── 2) El admin puede notificar a cualquier usuario (campanilla) ────────────
DO $$ BEGIN
  CREATE POLICY "Admins can insert notifications" ON public.notifications
    FOR INSERT TO authenticated
    WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND type = 'system'::notification_type);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 3) Contabilidad de compras del marketplace (fee de intermediación) ──────
-- Venta concretada  → debit receivable_marketplace_fee / credit revenue_platform
-- Fee cobrado       → debit cash_stripe / credit receivable_marketplace_fee
CREATE OR REPLACE FUNCTION public.mm_marketplace_fee_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g uuid;
  prod_name text;
  meta jsonb;
BEGIN
  SELECT name INTO prod_name FROM marketplace_products WHERE id = NEW.product_id;
  meta := jsonb_build_object(
    'interest_id', NEW.id,
    'product_id', NEW.product_id,
    'buyer_id', NEW.buyer_id,
    'product_price', NEW.product_price,
    'source', 'marketplace_fee_model'
  );

  IF NEW.status = 'completed' AND COALESCE(OLD.status, '') <> 'completed' THEN
    g := gen_random_uuid();
    INSERT INTO accounting_ledger (transaction_group, entry_type, account, amount, currency, vendor_id, description, metadata) VALUES
      (g, 'debit',  'receivable_marketplace_fee', NEW.fee_amount, NEW.currency, NEW.vendor_id,
       'Fee por cobrar — venta concretada: ' || COALESCE(prod_name, 'producto'), meta),
      (g, 'credit', 'revenue_platform', NEW.fee_amount, NEW.currency, NEW.vendor_id,
       'Comisión marketplace — venta concretada: ' || COALESCE(prod_name, 'producto'), meta);
  END IF;

  IF NEW.fee_status = 'paid' AND COALESCE(OLD.fee_status, '') <> 'paid' THEN
    g := gen_random_uuid();
    INSERT INTO accounting_ledger (transaction_group, entry_type, account, amount, currency, vendor_id, description, metadata) VALUES
      (g, 'debit',  'cash_stripe', NEW.fee_amount, NEW.currency, NEW.vendor_id,
       'Fee cobrado (Stripe) — ' || COALESCE(prod_name, 'producto'), meta),
      (g, 'credit', 'receivable_marketplace_fee', NEW.fee_amount, NEW.currency, NEW.vendor_id,
       'Fee saldado — ' || COALESCE(prod_name, 'producto'), meta);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mm_marketplace_fee_ledger ON public.product_interests;
CREATE TRIGGER trg_mm_marketplace_fee_ledger
  AFTER UPDATE ON public.product_interests
  FOR EACH ROW EXECUTE FUNCTION public.mm_marketplace_fee_ledger();

-- Backfill contable: asentar las ventas concretadas y fees ya pagados que
-- ocurrieron antes del trigger (solo si no tienen asiento).
DO $$
DECLARE
  r record;
  g uuid;
  prod_name text;
  meta jsonb;
BEGIN
  FOR r IN
    SELECT pi.* FROM product_interests pi
    WHERE pi.status IN ('completed', 'paid')
      AND NOT EXISTS (
        SELECT 1 FROM accounting_ledger al
        WHERE al.metadata->>'interest_id' = pi.id::text
          AND al.account = 'revenue_platform'
      )
  LOOP
    SELECT name INTO prod_name FROM marketplace_products WHERE id = r.product_id;
    meta := jsonb_build_object('interest_id', r.id, 'product_id', r.product_id,
      'buyer_id', r.buyer_id, 'product_price', r.product_price, 'source', 'marketplace_fee_model_backfill');
    g := gen_random_uuid();
    INSERT INTO accounting_ledger (transaction_group, entry_type, account, amount, currency, vendor_id, description, metadata, created_at) VALUES
      (g, 'debit',  'receivable_marketplace_fee', r.fee_amount, r.currency, r.vendor_id,
       'Fee por cobrar — venta concretada: ' || COALESCE(prod_name, 'producto'), meta, COALESCE(r.completed_at, r.created_at)),
      (g, 'credit', 'revenue_platform', r.fee_amount, r.currency, r.vendor_id,
       'Comisión marketplace — venta concretada: ' || COALESCE(prod_name, 'producto'), meta, COALESCE(r.completed_at, r.created_at));
    IF r.fee_status = 'paid' THEN
      g := gen_random_uuid();
      INSERT INTO accounting_ledger (transaction_group, entry_type, account, amount, currency, vendor_id, description, metadata, created_at) VALUES
        (g, 'debit',  'cash_stripe', r.fee_amount, r.currency, r.vendor_id,
         'Fee cobrado (Stripe) — ' || COALESCE(prod_name, 'producto'), meta, COALESCE(r.fee_paid_at, r.completed_at, r.created_at)),
        (g, 'credit', 'receivable_marketplace_fee', r.fee_amount, r.currency, r.vendor_id,
         'Fee saldado — ' || COALESCE(prod_name, 'producto'), meta, COALESCE(r.fee_paid_at, r.completed_at, r.created_at));
    END IF;
  END LOOP;
END $$;
