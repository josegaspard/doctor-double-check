-- Make the landing "credibility stats" admin-editable (legal-sensitive numbers
-- like "5,000+ doctores", "98% satisfacción"). New site_settings row + public read.
insert into site_settings(id, value) values (
  'landing_stats',
  '{"active_doctors":"5,000+","patients_served":"15M+","satisfaction":"98%","availability":"24/7","enterprise_absenteeism":"40%","enterprise_roi":"3x","enterprise_satisfaction":"95%","enterprise_support":"24/7"}'::jsonb
) on conflict (id) do nothing;

drop policy if exists "Public can read public settings" on public.site_settings;
create policy "Public can read public settings"
  on public.site_settings for select
  using (id = any (array[
    'social_links','terms_of_service','privacy_policy','contact_info',
    'storage_pricing','feature_toggles','subscription_pricing','landing_stats'
  ]));
