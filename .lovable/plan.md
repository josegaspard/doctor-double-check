

# Plan: Fix Mobile Floating Bar + Content Thumbnails

## 1. Fix Floating Selection Bar on Mobile (`DoctorRecordings.tsx`)

**Problem**: The floating bulk-delete bar at line 890 uses a simple `rounded-full` pill layout that breaks on small screens — the text "1 seleccionada(s)" wraps badly and the whole element looks oversized (as seen in the screenshot).

**Fix**:
- Replace the current pill layout with a proper bottom sheet-style bar: `w-[calc(100%-2rem)]` with `rounded-xl` instead of `rounded-full`
- Use `flex items-center justify-between` so the count and button are spaced properly
- Shrink text to `text-xs` on mobile, keep `sm:text-sm`
- Reduce padding: `px-4 py-2.5` instead of `px-5 py-3`
- Add `max-w-sm mx-auto` to prevent it from being too wide on tablets

## 2. Fix Content Thumbnails Not Showing (`ContentGallery.tsx`)

**Problem**: The `generateVideoThumbnail` function fails silently due to CORS restrictions on cross-origin videos (Supabase signed URLs and Cloudflare URLs both block canvas `toDataURL`). When it fails, the fallback just returns `null`, so videos show a generic icon placeholder instead of a real thumbnail.

**Fix**:
- For **video** content that has no `thumbnail_url`: instead of trying to generate a canvas thumbnail (which fails due to CORS), generate a signed URL for the video file and use a `<video>` element as the thumbnail with `poster` or show the video element itself muted at the first frame
- Simplify: just get a signed URL for the `file_url` and use it as the thumb source (for both images and videos stored in Supabase storage)
- For videos with HTTP URLs (Cloudflare), use the file_url directly as thumb source with a `<video>` element displaying the first frame
- Remove the complex `generateVideoThumbnail` canvas approach entirely — replace with direct signed URL resolution for all non-HTTP storage paths

**Approach**: In `fetchContents`, for any content without `thumbnail_url`:
- If `file_url` starts with `http` → use it directly as `signedThumbs[id]`
- Otherwise → get a signed URL from `doctor-content` bucket
- In `ContentCardThumbnail`, for videos render a `<video>` element (muted, preload metadata) showing the first frame; for images render an `<img>`

## Files to Modify
- `src/pages/DoctorRecordings.tsx` — fix floating bar layout
- `src/pages/ContentGallery.tsx` — replace canvas thumbnail generation with signed URL + `<video>` element approach

