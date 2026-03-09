

# Plan: Mobile UX Optimization for Availability, Content Gallery, and Doctor Filtering Fix

## 1. Fix Doctor City Filter (duplicate function)

There are **two overloads** of `get_doctors_paginated` in the database — one with 4 params and one with 5 params (with `p_location`). PostgreSQL may be calling the old 4-param version when the client passes `p_location`, or the ambiguity could cause errors.

**Fix**: Database migration to `DROP` the old 4-param version, keeping only the 5-param version with `p_location`.

Also, the `locationSearchMap` in `Doctors.tsx` maps "CDMX" to "Ciudad de M" — this should work with ILIKE but needs to also match "CDMX" directly since some doctors may have "CDMX" as their location. Update the map to search for both terms by using a broader match, or simply pass the chip label directly since the ILIKE `%CDMX%` will match "CDMX" in the location, and "Ciudad de M" will match "Ciudad de México". Best approach: pass the raw chip label and let ILIKE handle it — except for "CDMX" which needs to also match "Ciudad de Mexico". Keep the existing map but add fallback: if `locationFilter` is "CDMX", search for "Mexico" (which matches "Ciudad de México", "Ciudad de Mexico", "CDMX" won't be caught but that's fine since the 5-param function also does ILIKE). Actually simplest fix: just remove the map and pass the raw chip label. "CDMX" will match any location containing "CDMX". "Guadalajara" will match locations containing "Guadalajara". The issue was the old 4-param function being called.

**Files**: Migration SQL, `src/pages/Doctors.tsx` (simplify locationSearchMap)

## 2. Availability Page Mobile UX Optimization

**Current state**: The page works but the dialog and list could be more polished on mobile.

**Changes to `src/pages/DoctorAvailability.tsx`**:
- Make the dialog full-screen on mobile (`max-h-[100dvh] h-full sm:h-auto sm:max-h-[90vh]` with `rounded-none sm:rounded-lg`)
- Reduce the calendar size on mobile by using a compact popover
- Add visual type selector (icon buttons instead of plain `<select>`) for the availability type
- Improve the header: make "Programar" button more prominent, reduce spacing
- Tighter card spacing in the availability list
- Add bottom safe area padding for the sticky bar

## 3. Content Gallery Mobile UX + Video Thumbnails

**Problem**: Videos in content gallery show a generic icon placeholder instead of a frame from the video.

**Fix in `ContentGallery.tsx`**:
- For video-type content without a `thumbnail_url`, generate a thumbnail client-side by loading the video into a hidden `<video>` element, seeking to 1 second, and capturing a frame via `<canvas>`. Cache these generated thumbnails in state.
- Create a helper function `generateVideoThumbnail(videoUrl)` that returns a data URL.
- After fetching contents, for videos without thumbnails, get signed URLs and generate thumbnails.

**Mobile UX improvements**:
- Content cards: tighter grid on mobile (`grid-cols-1` already, but reduce gap and card padding)
- Tabs: make full-width with equal sizing on mobile
- Filters: horizontal scroll for category chips instead of dropdown on mobile
- Content preview modal: ensure it scrolls to top when opened

## 4. Content Preview Modal — Scroll Fix

The `ContentPreviewModal` already handles scrolling internally. The `ScrollToTop` component added in the last change should handle navigation-based scroll issues. But when clicking a content card within the same page (no navigation), the modal opens at whatever scroll position. This is actually fine since it's a dialog overlay — it opens centered. The real issue was navigating to a different page after purchase. The `ScrollToTop` component should fix this.

---

## Technical Changes Summary

### Migration: Drop old `get_doctors_paginated` overload
```sql
DROP FUNCTION IF EXISTS public.get_doctors_paginated(integer, integer, text, text);
```
This keeps only the 5-param version with `p_location`.

### `src/pages/Doctors.tsx`
- Simplify `locationSearchMap`: remove the map entirely, pass `locationFilter` directly to `p_location`. For "CDMX", also search "Ciudad de M" by keeping just that one mapping. Actually, keep it simple: map "CDMX" → "Ciudad de M" and pass all others directly.

### `src/pages/DoctorAvailability.tsx`
- Dialog: full-height on mobile with `rounded-none sm:rounded-lg`, better internal spacing
- Type selector: replace `<select>` with icon-button group (Live/Consulta/Oficina)
- Reduce overall spacing for mobile density
- Calendar popover: ensure proper mobile sizing

### `src/pages/ContentGallery.tsx`
- Add `generateVideoThumbnail` function that creates a data URL from a video's first second
- After fetching, for videos without thumbnails, generate client-side thumbnails
- Improve mobile card layout: reduce padding, tighter spacing
- Tabs: full-width on mobile

### `src/components/content/ContentPreviewModal.tsx`
- Add `max-h-[100dvh] sm:max-h-[90vh]` and better mobile padding
- Ensure video auto-scrolls into view when modal opens

