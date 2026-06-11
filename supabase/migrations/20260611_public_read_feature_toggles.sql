-- BUG FIX: feature_toggles was NOT in the public-read allowlist, so non-admin
-- users (patients/visitors) could never read the real toggles — they always
-- fell back to client-side defaults. That silently broke the admin toggles for
-- everyone except admins (and would break the new section kill-switches).
-- feature_toggles = on/off flags (non-sensitive); subscription_pricing = public
-- prices shown on the site anyway. Both are safe to expose read-only.
drop policy if exists "Public can read public settings" on public.site_settings;
create policy "Public can read public settings"
  on public.site_settings for select
  using (id = any (array[
    'social_links','terms_of_service','privacy_policy','contact_info',
    'storage_pricing','feature_toggles','subscription_pricing'
  ]));
