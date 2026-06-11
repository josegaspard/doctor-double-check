-- Admin-editable email branding (read by _shared/email-template.ts at module init).
insert into site_settings(id, value) values (
  'email_branding',
  '{"brand_name":"Medical Masters","tagline":"Plataforma de telemedicina","primary_color":"#00768b","support_url":"https://medical-masters.com/contact","support_label":"Contáctanos"}'::jsonb
) on conflict (id) do nothing;

drop policy if exists "Public can read public settings" on public.site_settings;
create policy "Public can read public settings"
  on public.site_settings for select
  using (id = any (array[
    'social_links','terms_of_service','privacy_policy','contact_info',
    'storage_pricing','feature_toggles','subscription_pricing','landing_stats',
    'app_config','extra_specialties','text_overrides','email_branding'
  ]));
