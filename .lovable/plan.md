

# Plan: Auto-thumbnail from live, editable thumbnails in Recordings, tablet layout fixes

## 1. Auto-capture thumbnail from live start

When the live starts and the doctor did NOT provide a custom thumbnail, capture a frame from the video stream after ~3 seconds and upload it as the thumbnail.

### `src/pages/DoctorGoLive.tsx`
- After `localRecording.startRecording(stream)` (line 184), if `!config.thumbnailFile`, set a 3-second timeout that:
  - Creates a hidden `<video>` element from `stream`
  - Draws a frame onto a `<canvas>`
  - Converts to blob via `canvas.toBlob('image/jpeg', 0.8)`
  - Uploads to `thumbnails` bucket at `{userId}/{liveId}-auto.jpg`
  - Updates `lives.thumbnail_url` with the public URL
  - Also updates `recordings.thumbnail_url` later when the recording is saved
- When saving the recording (background upload around line 287-298), copy the live's `thumbnail_url` to the recording's `thumbnail_url`

### `src/hooks/cloudflare/useLocalRecording.ts`
- In `uploadRecording`, accept optional `thumbnailUrl` param and include it in the insert/update payload instead of `null`

## 2. Edit thumbnail from Recordings page

### `src/pages/DoctorRecordings.tsx`
- Add "Editar portada" option to the dropdown menu (both mobile and desktop)
- Add a new dialog `thumbnailDialogOpen` with:
  - Current thumbnail preview (if exists)
  - File input to upload a new image
  - Save button that uploads to `thumbnails` bucket and updates `recordings.thumbnail_url`
- The thumbnail should also show in the table/card: replace the gray play icon placeholder (line 1096) with the actual thumbnail image if available
- In the stats dialog, show the current thumbnail

## 3. Fix tablet layout issues

### `src/pages/Doctors.tsx` — Sidebar sticky + tablet doctor cards
- The sidebar sticky IS correctly configured (`sticky top-24 self-start`). The issue is likely `MainLayout` or the parent container having `overflow: hidden`. 
- Check `MainLayout` for overflow constraints. Add `overflow-visible` to the grid container on line 327.
- Doctor cards at tablet width (769px): the grid currently uses `sm:grid-cols-2` which shows 2 columns at tablet. The cards have dense content with truncated text ("Disponib le ahora", "Ciudad ..."). Fix:
  - Ensure `PriceDisplay` doesn't wrap oddly at tablet
  - The "Doctores Disponibles Ahora" banner cards at tablet need min-width adjusted so content doesn't squeeze

### `src/pages/DoctorRecordings.tsx` — Tablet table
- The recordings table (screenshot 3) shows squeezed columns at tablet because it keeps the full desktop table at `md` breakpoint but viewport is only 769px wide
- Add `min-w-[800px]` to the Table so it scrolls horizontally on tight tablets instead of squeezing all columns
- Apply same fix to Past Lives table

### `src/pages/RecordingsGrid.tsx` — Content cards at tablet
- The content gallery cards look fine at tablet (4-column grid) based on screenshots. Minor adjustments if needed.

### `src/components/layout/UnifiedFooter.tsx` — Tablet footer
- Footer badge rendering at tablet width shows squeezed text in App Store/Google Play badges. Add `min-w-[120px]` to store badges and ensure they don't wrap text internally.

## Files to modify
1. `src/pages/DoctorGoLive.tsx` — auto-capture thumbnail from stream
2. `src/hooks/cloudflare/useLocalRecording.ts` — accept thumbnailUrl param
3. `src/pages/DoctorRecordings.tsx` — edit thumbnail dialog + show thumbnails in table + tablet table fix
4. `src/pages/Doctors.tsx` — overflow fix for sticky sidebar + tablet card adjustments
5. `src/components/layout/UnifiedFooter.tsx` — tablet badge sizing

