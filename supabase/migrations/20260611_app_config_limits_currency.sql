-- Admin-editable amount limits + currency code. Defaults = current hardcoded
-- values, and added to the public-read allowlist (non-sensitive: a currency code
-- + numeric limits). Edge functions read with a hard fallback, so a missing
-- setting changes nothing.
insert into site_settings(id, value) values (
  'app_config',
  '{"currency":"mxn","wallet_min":50,"wallet_max":999999,"ad_min":100,"ad_max":1000000}'::jsonb
) on conflict (id) do nothing;

drop policy if exists "Public can read public settings" on public.site_settings;
create policy "Public can read public settings"
  on public.site_settings for select
  using (id = any (array[
    'social_links','terms_of_service','privacy_policy','contact_info',
    'storage_pricing','feature_toggles','subscription_pricing','landing_stats','app_config'
  ]));
