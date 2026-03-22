

# Plan: Fix click_url, delete storage files, allow editing creatives

## Problems
1. **click_url shows "#"**: When uploading a creative, if no URL was entered, it saves `'#'` as default. The existing creative view only shows this "#" with no way to edit it afterward.
2. **Deleting creative doesn't delete the file from storage**: `deleteCreative` only removes the DB row but leaves the video/image file in the `ad-creatives` bucket, wasting storage.
3. **No way to edit click_url on already-uploaded creatives**.

## Changes

### `src/pages/AdvertiserDashboard.tsx`

**Fix 1 — Don't default to '#', require URL before upload:**
- Line 309: Change `click_url: clickUrls[placementId] || '#'` → validate that `clickUrls[placementId]` is not empty before uploading. Show toast error "Ingresa una URL de destino" if empty.

**Fix 2 — Delete storage file when deleting creative:**
- In `deleteCreative`, extract the storage path from `media_url` (everything after `/ad-creatives/`) and call `supabase.storage.from('ad-creatives').remove([path])` before deleting the DB row.

**Fix 3 — Allow editing click_url on existing creatives:**
- In `PlacementUploadCard`, when `existingCreative` exists, show the click_url in an editable Input field instead of just a truncated text.
- Add a save button that updates the creative's `click_url` in the database.
- Show the full URL, not truncated.

**Fix 4 — UX improvements to PlacementUploadCard:**
- Show the click_url as an editable field with a save/update button when creative exists
- Add a label "URL de destino" above the URL
- Show media preview larger (w-20 h-14 instead of w-16 h-12)
- Better visual separation between media preview and URL edit

## Files to modify
1. `src/pages/AdvertiserDashboard.tsx` — all fixes above

