
-- Add shipping and tracking columns to marketplace_orders
ALTER TABLE public.marketplace_orders 
  ADD COLUMN IF NOT EXISTS shipping_name text,
  ADD COLUMN IF NOT EXISTS shipping_phone text,
  ADD COLUMN IF NOT EXISTS shipping_city text,
  ADD COLUMN IF NOT EXISTS shipping_state text,
  ADD COLUMN IF NOT EXISTS shipping_zip text,
  ADD COLUMN IF NOT EXISTS shipping_notes text,
  ADD COLUMN IF NOT EXISTS tracking_number text,
  ADD COLUMN IF NOT EXISTS estimated_delivery date,
  ADD COLUMN IF NOT EXISTS delivery_fee numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

-- Ensure RLS is enabled
ALTER TABLE public.marketplace_orders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to avoid conflicts
DROP POLICY IF EXISTS "Buyers can view own orders" ON public.marketplace_orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON public.marketplace_orders;
DROP POLICY IF EXISTS "Admins can update orders" ON public.marketplace_orders;

-- Buyers can see their own orders
CREATE POLICY "Buyers can view own orders"
  ON public.marketplace_orders FOR SELECT
  TO authenticated
  USING (buyer_id = auth.uid());

-- Admins can view all orders
CREATE POLICY "Admins can view all orders"
  ON public.marketplace_orders FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update orders (status, tracking, etc.)
CREATE POLICY "Admins can update orders"
  ON public.marketplace_orders FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
