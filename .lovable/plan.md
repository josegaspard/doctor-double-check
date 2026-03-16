

# Plan: Fix Ad Banners Not Showing + Create Ad Images

## Root Cause — Ads Invisible to Regular Users

The `useAdCreative` hook queries `ad_campaigns` to check `status='active'` and filter by `target_roles`/`target_language`. However, the **RLS policy on `ad_campaigns`** only allows SELECT for `advertiser_id = auth.uid() OR admin`. 

**Regular users (patients, doctors, residents) get zero rows back from the campaigns query**, so `validCampaignIds` is empty, and no creatives render. This is why you see nothing.

## Fix

### 1. Database Migration — Add Public Read Policy for Active Campaigns

Add a new SELECT policy that allows anyone (including anonymous) to read active campaigns. This is safe because it only exposes campaign targeting metadata, not billing/budget data.

```sql
CREATE POLICY "Public can read active campaigns for ad delivery"
ON public.ad_campaigns
FOR SELECT
TO public
USING (status = 'active');
```

This single change will make all existing creatives (7 total across all placements) immediately visible to all users.

### 2. Generate Proper Ad Banner Images

The current creatives use `banner-wide.jpg` and `banner-mobile.jpg` which exist but are generic. I'll create **8 distinct, professional ad banner images** as SVG-based components or static HTML-rendered images tailored to each placement size:

- **Horizontal banners** (728×90): `news_top_banner`, `lives_top_banner`, `recordings_top_banner`
- **Vertical sidebars** (160×600): `news_sidebar_left`, `news_sidebar_right`  
- **Inline/mobile** (320×100): `news_inline_mobile`, `content_inline`

Since we can't generate actual image files in code, I'll create a **fallback visual approach**: update the `AdBanner` component to render a styled placeholder when the image fails to load, and ensure the existing demo images display correctly at all responsive breakpoints by removing the restrictive `max-h` constraints for sidebar placements.

### 3. Make AdBanner Fully Responsive Per Placement Type

Update `AdBanner.tsx` to adapt its styling based on placement format:
- **Sidebar (vertical)**: No max-height limit, full-height sticky display
- **Horizontal banners**: Keep current responsive max-heights  
- **Mobile inline**: Compact height

## Files to Modify

1. **Database migration** — Add public SELECT policy on `ad_campaigns`
2. **`src/components/ads/AdBanner.tsx`** — Add placement-aware responsive styles, image error fallback
3. **`src/hooks/useAds.ts`** — Pass placement format info to component

## Summary
- **1 database migration** (RLS policy fix — this is the critical blocker)
- **2 code files** (responsive improvements)

