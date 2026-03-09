

# Plan: Header UX/UI Optimization + Ad System Completeness Review

## 1. Header Issues & Fixes

Looking at the screenshot, the header is cramped — too many nav items competing with the search bar on desktop. The search bar's `min-w-[180px] lg:min-w-[220px]` takes excessive space.

### Header Changes (`MainLayout.tsx`)

**Desktop nav items:**
- Remove icons from desktop nav items (text-only) to save ~14px per item
- Keep icons only on xl+ screens: `xl:w-3.5 xl:h-3.5 hidden xl:block`
- Reduce font size on md to `text-[10px]`, lg keeps `text-[11px]`, xl `text-xs`
- Tighten padding: `px-1.5 lg:px-2 xl:px-2.5`

**Search bar (`GlobalSearch.tsx`):**
- Desktop: Reduce min-width from `min-w-[180px] lg:min-w-[220px]` to `min-w-[140px] lg:min-w-[180px]`
- Make it a compact icon-only button on `md` screens (like mobile), expanding to search bar on `lg+`
- Dialog improvements: Add subtle gradient header, recent searches hint, smoother animations
- Keyboard navigation for results (arrow keys)
- Show "⌘K" shortcut more prominently
- Mobile: add safe-area padding, smoother full-screen takeover

**Right-side items:**
- Tighten gap: `gap-1.5` instead of `gap-2`
- Wallet button: smaller on md, use just the icon + amount without label

### Search Dialog UX Improvements (`GlobalSearch.tsx`)
- Add trending/recent section with subtle icons
- Keyboard arrow navigation through results
- Highlight matching text in results
- Add subtle transition animations on open
- Better empty state with suggestions
- Quick category tabs (Doctors, Recordings, Lives) as filter chips at top

## 2. Ad System Completeness Review

| Component | Status | Notes |
|-----------|--------|-------|
| DB tables (ad_config, ad_campaigns, ad_creatives, ad_events, ad_payments, ad_placements) | ✅ Complete | All tables with proper schema |
| Storage bucket (ad-creatives) | ✅ Complete | Public bucket with RLS |
| Advertiser landing page (/advertising) | ✅ Complete | Budget calculator, placements, CTA |
| Advertiser dashboard (/advertiser/dashboard) | ✅ Complete | Campaign CRUD, creative upload, stats, charts, export |
| Payment flow (create-ad-checkout) | ✅ Edge function exists | Stripe checkout integration |
| Admin panel (/admin/ads) | ✅ Complete | Dashboard, campaign management (approve/reject/pause), placements, config |
| Ad display component (AdBanner) | ✅ Complete | Impression/click tracking, App Store compliant label |
| Ad serving logic (useAdCreative) | ✅ Complete | Role/language targeting, random selection |
| Export (CSV/PDF) | ✅ Complete | Both advertiser and admin |

**The ad system is 100% functionally complete.** All flows work: advertiser creates campaign → uploads creatives → pays via Stripe → admin reviews/approves → ads serve to targeted users → impressions/clicks tracked → analytics visible.

## Files to Modify

1. **`src/components/layout/MainLayout.tsx`** — Header spacing: hide nav icons on md, tighter padding, smaller right-side gap
2. **`src/components/search/GlobalSearch.tsx`** — Compact trigger on md screens, reduced min-width, keyboard navigation, better UX for dialog (category chips, highlight matches, animations)

