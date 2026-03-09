

# Plan: Complete Advertising Platform

This is a large feature. I'll break it into the essential building blocks that create a fully functional, measurable ad system.

## Database Schema (Single Migration)

### Tables to create:

**`ad_config`** — Global on/off switch + pricing (single row, admin-managed)
- `id`, `is_active` (bool), `cpm_rate` (cost per 1000 impressions), `cpc_rate` (cost per click), `min_budget`, `max_file_size_kb`, `allowed_formats` (text[]), `updated_at`

**`ad_placements`** — Where ads can appear (admin-managed)
- `id`, `name` (e.g. "lives_top_banner"), `display_name`, `description`, `width` (int), `height` (int), `format` ("banner"|"sidebar"|"interstitial"), `is_active` (bool), `sort_order`

**`ad_campaigns`** — Advertiser's campaigns
- `id`, `advertiser_id` (uuid → auth.users), `name`, `status` ("draft"|"pending_payment"|"pending_review"|"active"|"paused"|"completed"|"rejected"), `budget` (numeric), `spent` (numeric default 0), `target_impressions` (int), `target_clicks` (int), `start_date`, `end_date`, `target_roles` (text[] — e.g. ['patient','resident','doctor']), `target_language` (text nullable), `placement_ids` (uuid[]), `created_at`, `updated_at`

**`ad_creatives`** — The actual banner assets per campaign
- `id`, `campaign_id` (uuid → ad_campaigns), `placement_id` (uuid → ad_placements), `media_url` (text), `media_type` ("image"|"gif"|"video"), `click_url` (text), `alt_text`, `is_active` (bool), `created_at`

**`ad_events`** — Impressions & clicks log
- `id`, `creative_id` (uuid → ad_creatives), `campaign_id` (uuid → ad_campaigns), `event_type` ("impression"|"click"), `user_id` (uuid nullable), `user_role` (text nullable), `user_language` (text nullable), `ip_hash` (text nullable), `created_at` (timestamptz default now())

**`ad_payments`** — Payment records
- `id`, `campaign_id` (uuid → ad_campaigns), `amount` (numeric), `payment_method` ("stripe"|"wallet"), `stripe_session_id` (text nullable), `status` ("pending"|"paid"|"failed"), `created_at`

### RLS Policies:
- `ad_config`, `ad_placements`: anyone can read, only admins can write
- `ad_campaigns`: advertisers see own, admins see all
- `ad_creatives`: same as campaigns
- `ad_events`: insert for authenticated (tracking), select for campaign owner + admin
- `ad_payments`: campaign owner + admin

### Storage:
- Create `ad-creatives` bucket (public) for banner images/gifs/videos

## New Pages & Components

### 1. `src/pages/AdminAds.tsx` — Admin Ad Management
- **Dashboard tab**: Total revenue, active campaigns count, impressions/clicks today/week/month with charts
- **Campaigns tab**: List all campaigns with status badges, approve/reject/pause actions
- **Placements tab**: CRUD for ad placements (name, dimensions, format, active toggle)
- **Config tab**: Global on/off toggle, CPM/CPC rates, min budget, allowed formats
- **Export**: PDF and CSV export of campaign data and revenue

### 2. `src/pages/Advertising.tsx` — Public advertiser landing + onboarding
- Hero section explaining the ad platform
- Pricing calculator: input budget → shows estimated impressions/clicks based on CPM/CPC rates
- Available placement preview (mockups with dimensions)
- CTA "Crear campaña" → requires login, then goes to advertiser dashboard

### 3. `src/pages/AdvertiserDashboard.tsx` — Advertiser's campaign manager
- Campaign list with status, budget, spent, impressions, clicks, CTR
- Create campaign wizard (3 steps):
  1. **Targeting**: name, budget, date range, target roles, language, placements
  2. **Creatives**: upload banners per placement (shows required dimensions), preview
  3. **Payment**: shows price breakdown (impressions × CPM + clicks × CPC), pay via Stripe or Wallet
- Campaign detail view with real-time stats chart (impressions/clicks over time)
- Export campaign data to CSV/PDF

### 4. `src/components/ads/AdBanner.tsx` — Display component
- Props: `placementId`, `className`
- Fetches active creative for the placement, filtered by user role/language
- Tracks impression on mount (debounced, once per session per creative)
- Tracks click on click
- Renders image/gif/video with proper aspect ratio
- Shows tiny "Publicidad" label (App Store compliance)
- Returns null if no active ad or ads system is disabled

### 5. Ad Placement Locations (non-intrusive, mobile-optimized)
- **`/lives` page**: Banner above the "Transmisiones en Vivo" header
- **`/news` page**: Between news articles (every 4th item)
- **`/recordings` page**: Top banner
- **`/content` page**: Between content rows
- **Landing page**: One banner section before footer

### 6. Edge Function: `create-ad-checkout/index.ts`
- Creates Stripe checkout session for campaign payment
- On success, updates campaign status to "pending_review"

## Footer Integration
- In `useFooterLinks`, add "Publicidad" link to the resources section when `ad_config.is_active = true`
- Link points to `/advertising`

## Routes to Add (in App.tsx)
- `/advertising` → Advertising (public landing)
- `/advertiser/dashboard` → AdvertiserDashboard (authenticated)
- `/admin/ads` → AdminAds (admin only)

## Admin Dashboard Integration
- Add "Publicidad" module card in `AdminDashboard.tsx` with pending campaigns count

## App Store Compliance
- Every ad banner shows a small "Ad" / "Publicidad" label
- No auto-playing audio
- No fullscreen interstitials that block content (banners only)
- Clear distinction between ads and content
- Advertisers must accept terms before creating campaigns

## Files to Create
- `supabase/migrations/xxx_ads_system.sql` (tables + RLS + bucket)
- `src/pages/AdminAds.tsx`
- `src/pages/Advertising.tsx`
- `src/pages/AdvertiserDashboard.tsx`
- `src/components/ads/AdBanner.tsx`
- `src/hooks/useAds.ts` (fetch config, placements, track events)
- `supabase/functions/create-ad-checkout/index.ts`

## Files to Edit
- `src/App.tsx` — add 3 routes
- `src/pages/AdminDashboard.tsx` — add Ads module card
- `src/pages/LivesGrid.tsx` — insert AdBanner
- `src/pages/RecordingsGrid.tsx` — insert AdBanner
- `src/pages/ContentGallery.tsx` — insert AdBanner
- `src/components/layout/UnifiedFooter.tsx` — conditional "Publicidad" link
- `src/hooks/useFooterLinks.ts` — add advertising link when active

Given the massive scope, I recommend implementing this in **2 phases**:
- **Phase 1** (this message): Database + Admin management + AdBanner component + placements in pages + footer link + advertiser onboarding landing
- **Phase 2** (next message): Advertiser dashboard with full analytics + Stripe checkout + export + campaign wizard

Shall I proceed with Phase 1?

