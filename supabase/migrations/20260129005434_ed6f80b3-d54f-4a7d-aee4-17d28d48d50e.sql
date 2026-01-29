-- Create site_settings table for dynamic site configuration
CREATE TABLE public.site_settings (
  id TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write site settings
CREATE POLICY "Admins can read site settings"
ON public.site_settings FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update site settings"
ON public.site_settings FOR UPDATE
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert site settings"
ON public.site_settings FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Public read policy for specific non-sensitive settings (social links, legal pages)
CREATE POLICY "Public can read public settings"
ON public.site_settings FOR SELECT
USING (id IN ('social_links', 'terms_of_service', 'privacy_policy'));

-- Insert default settings
INSERT INTO public.site_settings (id, value) VALUES
('social_links', '{"facebook": "", "instagram": "", "twitter": "", "linkedin": "", "youtube": ""}'),
('terms_of_service', '{"content": "", "lastUpdated": null}'),
('privacy_policy', '{"content": "", "lastUpdated": null}'),
('site_config', '{"maintenanceMode": false, "registrationEnabled": true}');

-- Create update trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_site_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_site_settings_updated_at
BEFORE UPDATE ON public.site_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_site_settings_timestamp();