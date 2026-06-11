-- Admin can override ANY i18n string (landing copy, CTAs, etc.) without a deploy.
-- Structure: { "<lang>": { "<i18nKey>": "text" } }. Empty/missing => normal i18n.
insert into site_settings(id, value) values ('text_overrides', '{}'::jsonb)
on conflict (id) do nothing;

drop policy if exists "Public can read public settings" on public.site_settings;
create policy "Public can read public settings"
  on public.site_settings for select
  using (id = any (array[
    'social_links','terms_of_service','privacy_policy','contact_info',
    'storage_pricing','feature_toggles','subscription_pricing','landing_stats',
    'app_config','extra_specialties','text_overrides'
  ]));
