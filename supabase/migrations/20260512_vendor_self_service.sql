-- Allow approved vendors to manage their own marketplace_products via RLS.

ALTER TABLE public.marketplace_products ENABLE ROW LEVEL SECURITY;

-- Drop any prior vendor self-service policies for idempotency
DROP POLICY IF EXISTS marketplace_products_public_read ON public.marketplace_products;
DROP POLICY IF EXISTS marketplace_products_vendor_write ON public.marketplace_products;
DROP POLICY IF EXISTS marketplace_products_vendor_update ON public.marketplace_products;
DROP POLICY IF EXISTS marketplace_products_vendor_delete ON public.marketplace_products;
DROP POLICY IF EXISTS marketplace_products_admin_all ON public.marketplace_products;

-- Public reads only active products. Vendor sees their own (including inactive).
CREATE POLICY marketplace_products_public_read ON public.marketplace_products
  FOR SELECT
  USING (
    is_active = true
    OR vendor_id IN (SELECT id FROM public.marketplace_vendors WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- Approved vendor can insert products only for their own vendor row.
CREATE POLICY marketplace_products_vendor_write ON public.marketplace_products
  FOR INSERT
  WITH CHECK (
    vendor_id IN (
      SELECT id FROM public.marketplace_vendors
      WHERE user_id = auth.uid() AND status = 'approved'
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY marketplace_products_vendor_update ON public.marketplace_products
  FOR UPDATE
  USING (
    vendor_id IN (
      SELECT id FROM public.marketplace_vendors
      WHERE user_id = auth.uid() AND status = 'approved'
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY marketplace_products_vendor_delete ON public.marketplace_products
  FOR DELETE
  USING (
    vendor_id IN (
      SELECT id FROM public.marketplace_vendors
      WHERE user_id = auth.uid() AND status = 'approved'
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- Vendors can read their own vendor row to know their approval status
ALTER TABLE public.marketplace_vendors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS marketplace_vendors_self_read ON public.marketplace_vendors;
CREATE POLICY marketplace_vendors_self_read ON public.marketplace_vendors
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR status = 'approved' -- public can see approved vendors
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS marketplace_vendors_self_update ON public.marketplace_vendors;
CREATE POLICY marketplace_vendors_self_update ON public.marketplace_vendors
  FOR UPDATE
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
