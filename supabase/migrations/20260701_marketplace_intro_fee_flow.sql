-- ============================================================================
-- Marketplace "reventa dr↔dr con fee de intermediación" (cliente 2026-07-01)
-- ----------------------------------------------------------------------------
-- Modelo NUEVO (distinto al e-commerce v2 existente con Stripe Connect/payouts):
--   * Solo doctores y residentes (NO pacientes) ven/usan el marketplace.
--   * Un dr/residente pide "verificación de negocio" (reusa marketplace_vendors,
--     status pending→approved por el admin) y acepta T&C para poder publicar.
--   * Cada producto tiene un fee = precio × fee_rate (fee_rate global, editable
--     por el admin). El vendedor cobra el producto POR FUERA; la plataforma solo
--     cobra el fee.
--   * El comprador (dr/residente) pulsa "Estoy interesado" → paga el FEE por
--     Stripe (a la MISMA cuenta del sitio = super admin, sin Connect) → se
--     APARTA el producto para él y se abre un CHAT con el proveedor. Cierran el
--     trato por fuera.
--
-- Esta migración NO toca el flujo e-commerce existente; agrega tablas/columnas
-- nuevas en paralelo. Idempotente (IF NOT EXISTS / DROP POLICY IF EXISTS).
-- ============================================================================

-- 1) CONFIG GLOBAL DEL MARKETPLACE (una sola fila) -------------------------
--    fee_rate = porcentaje que cobra la plataforma sobre el precio del producto.
CREATE TABLE IF NOT EXISTS public.marketplace_config (
  id            boolean PRIMARY KEY DEFAULT true,   -- single-row lock
  fee_rate      numeric(5,4) NOT NULL DEFAULT 0.10, -- 0.10 = 10%
  currency      text NOT NULL DEFAULT 'MXN',
  reserve_hours integer NOT NULL DEFAULT 72,        -- cuánto queda apartado tras pagar el fee
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    uuid REFERENCES auth.users(id),
  CONSTRAINT marketplace_config_singleton CHECK (id = true),
  CONSTRAINT marketplace_config_fee_range CHECK (fee_rate >= 0 AND fee_rate <= 1)
);

INSERT INTO public.marketplace_config (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.marketplace_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can read marketplace config" ON public.marketplace_config;
CREATE POLICY "anyone can read marketplace config"
  ON public.marketplace_config FOR SELECT USING (true);

DROP POLICY IF EXISTS "admins manage marketplace config" ON public.marketplace_config;
CREATE POLICY "admins manage marketplace config"
  ON public.marketplace_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) VERIFICACIÓN DE NEGOCIO: T&C del vendedor ----------------------------
--    Reusamos marketplace_vendors (pending/approved) y le agregamos la
--    aceptación de términos requerida para publicar.
ALTER TABLE public.marketplace_vendors
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

-- 3) APARTADO DE PRODUCTO --------------------------------------------------
--    Cuando un comprador paga el fee, el producto queda apartado para él.
ALTER TABLE public.marketplace_products
  ADD COLUMN IF NOT EXISTS reserved_by          uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reserved_at          timestamptz,
  ADD COLUMN IF NOT EXISTS reserved_until       timestamptz,
  ADD COLUMN IF NOT EXISTS reserved_interest_id uuid;

-- 4) ORIGEN DE LA CONVERSACIÓN DE CHAT ------------------------------------
--    Etiqueta el chat que nace del marketplace, para el filtro "Proveedores".
ALTER TABLE public.chat_sessions
  ADD COLUMN IF NOT EXISTS marketplace_interest_id uuid;

-- 5) INTERESES / APARTADOS CON FEE (núcleo del flujo) ---------------------
CREATE TABLE IF NOT EXISTS public.product_interests (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id               uuid NOT NULL REFERENCES public.marketplace_products(id) ON DELETE CASCADE,
  vendor_id                uuid NOT NULL REFERENCES public.marketplace_vendors(id) ON DELETE CASCADE,
  buyer_id                 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Snapshot del cobro al momento de crear el interés:
  fee_amount               numeric(12,2) NOT NULL,
  fee_rate                 numeric(5,4)  NOT NULL,
  product_price            numeric(12,2) NOT NULL,
  currency                 text NOT NULL DEFAULT 'MXN',
  terms_accepted           boolean NOT NULL DEFAULT false,
  status                   text NOT NULL DEFAULT 'pending_payment'
                             CHECK (status IN ('pending_payment','paid','cancelled','expired')),
  stripe_session_id        text,
  stripe_payment_intent_id text,
  chat_session_id          uuid REFERENCES public.chat_sessions(id) ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  paid_at                  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_product_interests_buyer   ON public.product_interests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_product_interests_vendor  ON public.product_interests(vendor_id);
CREATE INDEX IF NOT EXISTS idx_product_interests_product ON public.product_interests(product_id);
CREATE INDEX IF NOT EXISTS idx_product_interests_session ON public.product_interests(stripe_session_id);

-- FK diferida de products.reserved_interest_id → product_interests (ya existe la tabla)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_products_reserved_interest_fk'
  ) THEN
    ALTER TABLE public.marketplace_products
      ADD CONSTRAINT marketplace_products_reserved_interest_fk
      FOREIGN KEY (reserved_interest_id) REFERENCES public.product_interests(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.product_interests ENABLE ROW LEVEL SECURITY;

-- SELECT: comprador ve lo suyo; vendedor ve intereses de SUS productos; admin todo.
DROP POLICY IF EXISTS "interest visible to buyer vendor admin" ON public.product_interests;
CREATE POLICY "interest visible to buyer vendor admin"
  ON public.product_interests FOR SELECT TO authenticated
  USING (
    buyer_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.marketplace_vendors v
      WHERE v.id = product_interests.vendor_id AND v.user_id = auth.uid()
    )
  );

-- INSERT: el comprador crea su propio interés (siempre en pending_payment).
--         La transición a 'paid' la hace el webhook con service_role (bypassa RLS).
DROP POLICY IF EXISTS "buyer creates own interest" ON public.product_interests;
CREATE POLICY "buyer creates own interest"
  ON public.product_interests FOR INSERT TO authenticated
  WITH CHECK (buyer_id = auth.uid() AND status = 'pending_payment');

-- UPDATE: solo admin desde el cliente (cancelar/expirar). El pago lo marca el
--         webhook con service_role.
DROP POLICY IF EXISTS "admin updates interest" ON public.product_interests;
CREATE POLICY "admin updates interest"
  ON public.product_interests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6) HELPER: calcular el fee de un producto según la config global --------
CREATE OR REPLACE FUNCTION public.marketplace_fee_for_price(p_price numeric)
RETURNS numeric
LANGUAGE sql STABLE AS $$
  SELECT round(p_price * (SELECT fee_rate FROM public.marketplace_config WHERE id = true), 2);
$$;

-- ============================================================================
-- FIN. Deploy: `supabase db push` (requiere access token del proyecto).
-- El marketplace queda detrás del toggle `enable_marketplace` + feature flag
-- hasta terminar UI + edge functions y probar en staging.
-- ============================================================================
