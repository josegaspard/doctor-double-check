

# Plan: Fix Ad Banners Visibility + Confirm Routing

## 1. Database: Create Missing Ad Placements + Creatives

**Root cause:** `MedicalNews.tsx` references 4 placement names that don't exist in the database:
- `news_top_banner` — ❌ missing
- `news_sidebar_left` — ❌ missing (only `news_sidebar` exists, with no creative)
- `news_sidebar_right` — ❌ missing
- `news_inline_mobile` — ❌ missing

**Fix:** Run a database migration to:
1. Insert the 4 missing placements into `ad_placements`
2. Create `ad_creatives` entries for each, linked to the existing active campaign (`a0000000-...0001`), using the demo banner images already in storage

```sql
-- Insert 4 new placements
INSERT INTO ad_placements (name, display_name, width, height, format, is_active, sort_order)
VALUES
  ('news_top_banner', 'Noticias - Banner Superior', 728, 90, 'horizontal', true, 10),
  ('news_sidebar_left', 'Noticias - Lateral Izquierdo', 160, 600, 'vertical', true, 11),
  ('news_sidebar_right', 'Noticias - Lateral Derecho', 160, 600, 'vertical', true, 12),
  ('news_inline_mobile', 'Noticias - Inline Móvil', 320, 100, 'horizontal', true, 13);

-- Create creatives linking to existing demo campaign
INSERT INTO ad_creatives (campaign_id, placement_id, media_url, media_type, click_url, alt_text, is_active)
SELECT
  'a0000000-0000-0000-0000-000000000001'::uuid,
  p.id,
  CASE WHEN p.format = 'vertical'
    THEN 'https://jbthjpnxiwnegzgfzfth.supabase.co/storage/v1/object/public/ad-creatives/demo/banner-mobile.jpg'
    ELSE 'https://jbthjpnxiwnegzgfzfth.supabase.co/storage/v1/object/public/ad-creatives/demo/banner-wide.jpg'
  END,
  'image',
  'https://cirugiaesteticauribe.com',
  'Medical Masters - Publicidad Demo',
  true
FROM ad_placements p
WHERE p.name IN ('news_top_banner', 'news_sidebar_left', 'news_sidebar_right', 'news_inline_mobile');
```

No code changes needed — the `MedicalNews.tsx` ad code is already correct, it just has no data to display.

## 2. Routing — Already Correct

The routing is **already working as requested**:
- `Landing.tsx` (line 37-47): Unauthenticated users stay on `/` (landing). Authenticated users redirect to `/lives` (patients), `/doctor/dashboard` (doctors), or `/admin` (admins).
- `App.tsx` line 158: `<Route path="/" element={<Landing />} />`

No changes needed.

## Summary
- **1 database migration** to insert 4 ad placements + 4 creatives
- **0 code changes** — everything is already wired up correctly

