-- Update the public read policy to include storage_pricing and contact_info
DROP POLICY IF EXISTS "Public can read public settings" ON public.site_settings;

CREATE POLICY "Public can read public settings" 
ON public.site_settings 
FOR SELECT 
USING (id = ANY (ARRAY['social_links', 'terms_of_service', 'privacy_policy', 'contact_info', 'storage_pricing']));