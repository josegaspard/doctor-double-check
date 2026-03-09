
-- Ad system global config (single row)
CREATE TABLE public.ad_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  is_active BOOLEAN NOT NULL DEFAULT false,
  cpm_rate NUMERIC NOT NULL DEFAULT 50,
  cpc_rate NUMERIC NOT NULL DEFAULT 5,
  min_budget NUMERIC NOT NULL DEFAULT 500,
  max_file_size_kb INTEGER NOT NULL DEFAULT 2048,
  allowed_formats TEXT[] NOT NULL DEFAULT ARRAY['image','gif','video'],
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default config row
INSERT INTO public.ad_config (id) VALUES ('default');

-- Ad placements
CREATE TABLE public.ad_placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  width INTEGER NOT NULL DEFAULT 728,
  height INTEGER NOT NULL DEFAULT 90,
  format TEXT NOT NULL DEFAULT 'banner',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default placements
INSERT INTO public.ad_placements (name, display_name, description, width, height, format, sort_order) VALUES
  ('lives_top_banner', 'Lives - Banner Superior', 'Banner arriba de transmisiones en vivo', 728, 90, 'banner', 1),
  ('recordings_top_banner', 'Grabaciones - Banner Superior', 'Banner arriba de grabaciones', 728, 90, 'banner', 2),
  ('content_inline', 'Contenido - Inline', 'Entre filas de contenido premium', 728, 90, 'banner', 3),
  ('news_sidebar', 'Noticias - Lateral', 'Lateral de artículos de noticias', 300, 250, 'sidebar', 4);

-- Ad campaigns
CREATE TABLE public.ad_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  budget NUMERIC NOT NULL DEFAULT 0,
  spent NUMERIC NOT NULL DEFAULT 0,
  target_impressions INTEGER NOT NULL DEFAULT 0,
  target_clicks INTEGER NOT NULL DEFAULT 0,
  start_date DATE,
  end_date DATE,
  target_roles TEXT[] DEFAULT ARRAY['patient','resident','doctor'],
  target_language TEXT,
  placement_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ad creatives
CREATE TABLE public.ad_creatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  placement_id UUID NOT NULL REFERENCES public.ad_placements(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image',
  click_url TEXT NOT NULL DEFAULT '',
  alt_text TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ad events (impressions/clicks)
CREATE TABLE public.ad_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creative_id UUID NOT NULL REFERENCES public.ad_creatives(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  user_id UUID,
  user_role TEXT,
  user_language TEXT,
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for fast event queries
CREATE INDEX idx_ad_events_campaign ON public.ad_events(campaign_id, event_type);
CREATE INDEX idx_ad_events_creative ON public.ad_events(creative_id, event_type);
CREATE INDEX idx_ad_events_created ON public.ad_events(created_at);

-- Ad payments
CREATE TABLE public.ad_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'stripe',
  stripe_session_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Storage bucket for ad creatives
INSERT INTO storage.buckets (id, name, public) VALUES ('ad-creatives', 'ad-creatives', true);

-- RLS policies

-- ad_config: anyone can read, only admins can write
ALTER TABLE public.ad_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read ad config" ON public.ad_config FOR SELECT USING (true);
CREATE POLICY "Admins can update ad config" ON public.ad_config FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ad_placements: anyone can read, only admins can write
ALTER TABLE public.ad_placements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read placements" ON public.ad_placements FOR SELECT USING (true);
CREATE POLICY "Admins can manage placements" ON public.ad_placements FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ad_campaigns: advertisers see own, admins see all
ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Advertisers see own campaigns" ON public.ad_campaigns FOR SELECT TO authenticated USING (advertiser_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can create campaigns" ON public.ad_campaigns FOR INSERT TO authenticated WITH CHECK (advertiser_id = auth.uid());
CREATE POLICY "Owners and admins can update campaigns" ON public.ad_campaigns FOR UPDATE TO authenticated USING (advertiser_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete campaigns" ON public.ad_campaigns FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ad_creatives: same as campaigns
ALTER TABLE public.ad_creatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own creatives" ON public.ad_creatives FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.ad_campaigns c WHERE c.id = campaign_id AND (c.advertiser_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
);
CREATE POLICY "Active creatives visible to all" ON public.ad_creatives FOR SELECT USING (
  is_active = true AND EXISTS (SELECT 1 FROM public.ad_campaigns c WHERE c.id = campaign_id AND c.status = 'active')
);
CREATE POLICY "Owners can manage creatives" ON public.ad_creatives FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.ad_campaigns c WHERE c.id = campaign_id AND c.advertiser_id = auth.uid())
);
CREATE POLICY "Owners and admins update creatives" ON public.ad_creatives FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.ad_campaigns c WHERE c.id = campaign_id AND (c.advertiser_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
);

-- ad_events: insert for authenticated, select for campaign owner + admin
ALTER TABLE public.ad_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert events" ON public.ad_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Owners and admins read events" ON public.ad_events FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.ad_campaigns c WHERE c.id = campaign_id AND (c.advertiser_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
);

-- ad_payments: campaign owner + admin
ALTER TABLE public.ad_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners and admins read payments" ON public.ad_payments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.ad_campaigns c WHERE c.id = campaign_id AND (c.advertiser_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
);
CREATE POLICY "Owners can create payments" ON public.ad_payments FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.ad_campaigns c WHERE c.id = campaign_id AND c.advertiser_id = auth.uid())
);

-- Storage RLS for ad-creatives bucket
CREATE POLICY "Anyone can view ad creatives" ON storage.objects FOR SELECT USING (bucket_id = 'ad-creatives');
CREATE POLICY "Authenticated can upload ad creatives" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ad-creatives');
CREATE POLICY "Owners can update ad creatives" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'ad-creatives' AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "Owners can delete ad creatives" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'ad-creatives' AND (auth.uid())::text = (storage.foldername(name))[1]);
