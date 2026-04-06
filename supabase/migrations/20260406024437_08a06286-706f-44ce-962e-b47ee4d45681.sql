
-- Featured listings table for hospitals and products
CREATE TABLE public.featured_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_type TEXT NOT NULL CHECK (listing_type IN ('hospital', 'product')),
  listing_id UUID NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 1,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  budget NUMERIC NOT NULL DEFAULT 0,
  spent NUMERIC NOT NULL DEFAULT 0,
  cpc_rate NUMERIC NOT NULL DEFAULT 5,
  cpm_rate NUMERIC NOT NULL DEFAULT 50,
  label_es TEXT DEFAULT 'Destacado',
  label_en TEXT DEFAULT 'Featured',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Featured listing events (impressions, clicks)
CREATE TABLE public.featured_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  featured_id UUID NOT NULL REFERENCES public.featured_listings(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('impression', 'click')),
  user_id UUID,
  user_role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add is_featured column to hospitals for quick filtering
ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;

-- Add is_featured column to marketplace_products for quick filtering
ALTER TABLE public.marketplace_products ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;

-- RLS for featured_listings
ALTER TABLE public.featured_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active featured listings"
  ON public.featured_listings FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage featured listings"
  ON public.featured_listings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS for featured_events
ALTER TABLE public.featured_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert featured events"
  ON public.featured_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view featured events"
  ON public.featured_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Index for performance
CREATE INDEX idx_featured_listings_type_active ON public.featured_listings(listing_type, is_active);
CREATE INDEX idx_featured_events_featured_id ON public.featured_events(featured_id);
CREATE INDEX idx_featured_events_created_at ON public.featured_events(created_at);

-- Trigger for updated_at
CREATE TRIGGER update_featured_listings_updated_at
  BEFORE UPDATE ON public.featured_listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
