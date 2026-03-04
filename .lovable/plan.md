

# Fix: Content Library file previews + UX/UI improvements

## Root Cause Analysis

1. **PDF preview broken**: The `<iframe sandbox="allow-same-origin allow-scripts">` blocks the browser's built-in PDF viewer. The sandbox attribute is too restrictive — most browsers need `allow-popups` and full plugin access to render PDFs inline.

2. **Image thumbnails not loading in cards**: The gallery cards try to use `thumbnail_url` (which is rarely set) or show a generic icon. For images, the actual file could be displayed using a signed URL, but it's never fetched for the card grid.

3. **Signed URL may fail silently**: If the user isn't authenticated or the RLS policy doesn't match, `createSignedUrl` fails and the modal shows a broken state with a tiny icon and no useful feedback.

## Changes

### 1. Fix ContentPreviewModal (`src/components/content/ContentPreviewModal.tsx`)

- **PDF**: Remove `sandbox` attribute from iframe — it blocks the native PDF viewer. Keep `#toolbar=0` to discourage download. Add a fallback: if PDF doesn't render after 5s, show a "View PDF" button that opens in a new window (as a last resort).
- **Images**: Remove the invisible overlay `<div className="absolute inset-0" />` that blocks interaction but also prevents the image from rendering properly in some cases. Keep `pointer-events-none` on the img itself.
- **Error state**: Show a clearer error with a retry button and more descriptive text.
- **UX/UI overhaul of modal**:
  - Add doctor info (name, avatar) if available in the content prop
  - Show category badge, date, and price info
  - Better header layout with type icon colored by type (red for video, blue for PDF, green for image)
  - Rounded corners on preview area with subtle border

### 2. Fix ContentGallery cards (`src/pages/ContentGallery.tsx`)

- **Generate signed URLs for image thumbnails**: For items of type `image` that don't have a `thumbnail_url`, generate a signed URL from the `file_url` to show an actual preview in the card grid.
- **Better empty thumbnail area**: Instead of a tiny icon on a gradient, show a larger, more styled placeholder with the file type name.
- **Card UX improvements**:
  - Slightly increase icon size in placeholder thumbnails
  - Add hover effect with scale on thumbnail
  - Price badge on card if price > 0
  - Better visual hierarchy in card content area

### 3. Extend content type interface

- Pass `creator_name`, `creator_avatar`, `creator_specialty` to the preview modal so it can show doctor info context.

## Files to modify
- `src/components/content/ContentPreviewModal.tsx` — Fix PDF iframe, improve UI, add doctor info display
- `src/pages/ContentGallery.tsx` — Generate image previews for cards, improve card design, pass full content data to modal

