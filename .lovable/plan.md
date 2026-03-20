

# Plan: Fix thumbnail visibility in Contenido Premium + Fix tablet footer/UI

## Issue 1: Thumbnail not showing in Contenido Premium

**Root cause**: The `RecordingsGrid` page calls `ensureRecordingsLoaded()` which skips if recordings were already loaded. When the doctor updates a thumbnail on `/doctor/recordings`, the realtime event should trigger a refetch, but there's a timing issue — the doctor navigates away before the event propagates, and `ensureRecordingsLoaded` doesn't refetch stale data.

**Fix in `src/pages/RecordingsGrid.tsx`**:
- Replace `ensureRecordingsLoaded()` with `refreshRecordings()` to always get fresh data when this page mounts
- This ensures any thumbnails updated from `/doctor/recordings` are immediately visible

**Alternative (less aggressive)**: Call `refreshRecordings()` alongside `ensureRecordingsLoaded()` but debounced — but simpler is just to always refresh since this is a public catalog page.

## Issue 2: Tablet footer and UI broken (screenshots 2 & 3)

The footer and table look squished at tablet width. Looking at the screenshots:
- **Footer**: The 4-column grid at `md` breakpoint squishes columns. The `md:grid-cols-4` kicks in at 768px but 4 columns is too many for that width.
- **Recordings table**: Column headers wrap ("Especialid ad", "Duraci ón", "Ingres os") — too many columns for the width. The `min-w-[800px]` was added but the scrollbar might not be visible enough.

### Fix in `src/components/layout/UnifiedFooter.tsx`:
- App variant: Change `grid-cols-2 md:grid-cols-4` to `grid-cols-2 lg:grid-cols-4` so tablets (768-1023px) keep the 2-column layout
- Landing variant: Change `md:grid-cols-4 lg:grid-cols-5` to keep 2 cols on tablets, expand to 4-5 on desktop
- Increase `min-w` on app store badges to prevent text wrapping

### Fix in `src/pages/DoctorRecordings.tsx` (tablet table):
- The `min-w-[800px]` on the table should already force horizontal scroll. Check if the outer container has `overflow-x-auto`. If not, wrap the table in a div with `overflow-x-auto`.

## Files to modify
1. `src/pages/RecordingsGrid.tsx` — use `refreshRecordings` instead of `ensureRecordingsLoaded`
2. `src/components/layout/UnifiedFooter.tsx` — change grid breakpoints for tablet
3. `src/pages/DoctorRecordings.tsx` — ensure table scroll wrapper exists for tablet

