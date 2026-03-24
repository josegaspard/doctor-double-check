

# Plan: Allow uploading creatives without requiring URL first

## Problem
Both `AdminAds.tsx` and `AdvertiserDashboard.tsx` require the user to enter a destination URL **before** uploading a file. The user wants to upload the image/video first and add the URL afterward.

## Changes

### 1. `src/pages/AdminAds.tsx` — Remove URL-first requirement
- In `uploadCreative` (line 403-404): Remove the early return that blocks upload when URL is empty. Use empty string as default `click_url` when no URL is provided.
- After successful upload, the creative will appear with the editable URL field (the `PlacementUploadCard` already supports editing URL on existing creatives).

### 2. `src/pages/AdvertiserDashboard.tsx` — Same fix
- In `uploadCreative` (line 334-338): Remove the URL validation that blocks upload. Default `click_url` to empty string `''` instead of requiring it.

### 3. `PlacementUploadCard` in both files — Swap URL/upload order
- In the "no existing creative" section, move the upload drop zone **above** the URL input so the file picker appears first visually.
- Keep the URL input below as optional before upload.

This way users can:
1. Upload image/video first (no URL needed)
2. See the preview immediately
3. Add/edit the destination URL afterward using the existing save button

## Files to modify
1. `src/pages/AdminAds.tsx` — remove URL requirement + swap order
2. `src/pages/AdvertiserDashboard.tsx` — same changes

