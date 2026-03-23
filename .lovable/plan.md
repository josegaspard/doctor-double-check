

# Plan: Add Full Campaign Management to Admin Ads Panel

## Problem
The AdminAds page (`/admin/ads`) only allows the admin to view campaigns, approve/reject/pause them, and toggle creatives on/off. There is no way for the admin to:
- Create new campaigns
- Edit campaign details (name, budget, dates, targeting)
- Upload/replace/delete creative media (images, videos)
- Edit creative click URLs
- Delete campaigns

## Changes

### `src/pages/AdminAds.tsx` — Add full campaign CRUD + creative management

**1. Create Campaign functionality:**
- Add a "New Campaign" button + creation form (same as AdvertiserDashboard) with all fields: name, budget, dates, target roles, target language, placement selection
- Campaign is created with `advertiser_id = user.id` (admin's own ID)

**2. Edit Campaign:**
- When expanding a campaign, show editable fields (name, budget, dates, target roles, target language) with a Save button
- Add `updateCampaign` function that updates the campaign row

**3. Full Creative Management (reuse PlacementUploadCard pattern):**
- Replace the read-only creative list in expanded view with the `PlacementUploadCard` pattern from AdvertiserDashboard
- Each placement gets its own upload zone, URL input, and delete button
- Include storage cleanup on delete (remove file from `ad-creatives` bucket)
- Include `updateCreativeClickUrl` for editing URLs on existing creatives

**4. Delete Campaign:**
- Add delete button that removes all creatives (+ storage files) and the campaign itself

**5. Import shared components:**
- Import `PlacementMockup`, `PlacementUploadCard`, and `categorizePlacements` — since these are defined inside AdvertiserDashboard, I'll duplicate the essential logic inline in AdminAds (or extract to a shared file). Given the file sizes, I'll keep them inline in AdminAds for simplicity.

### `src/lib/i18n/es.ts` + `src/lib/i18n/en.ts`
- Add keys: `ads.editCampaign`, `ads.deleteCampaign`, `ads.confirmDeleteCampaign`, `ads.campaignUpdated`, `ads.adminCreateCampaign`

## Files to modify
1. `src/pages/AdminAds.tsx` — major additions (create, edit, delete campaigns + full creative management)
2. `src/lib/i18n/es.ts` — new keys
3. `src/lib/i18n/en.ts` — new keys

