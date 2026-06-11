-- Admin can add extra medical specialties without a deploy. Defaults stay in
-- src/lib/specialties.ts; this is an additive list merged on top. Public-read
-- (non-sensitive list of specialty names).
insert into site_settings(id, value) values ('extra_specialties', '[]'::jsonb)
on conflict (id) do nothing;

drop policy if exists "Public can read public settings" on public.site_settings;
create policy "Public can read public settings"
  on public.site_settings for select
  using (id = any (array[
    'social_links','terms_of_service','privacy_policy','contact_info',
    'storage_pricing','feature_toggles','subscription_pricing','landing_stats',
    'app_config','extra_specialties'
  ]));
