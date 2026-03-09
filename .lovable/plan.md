

# Plan: Content Library UX/UI Overhaul + Modal Fix

## Problems
1. **Filters are confusing** — dropdowns for type and category are not intuitive; users don't immediately understand how to filter content
2. **Modal close button (X) is hard to see/use on mobile** — it overlaps content, too small, no clear visual separation
3. **Overall mobile usability** needs polish: spacing, card density, filter discoverability

## Changes

### 1. `ContentGallery.tsx` — Replace dropdown filters with horizontal chip/bubble filters

- **Type filter**: Replace the `<Select>` dropdown with a horizontal scrollable row of chips (Todo, Videos, PDFs, Imágenes) with icons — similar to the doctor filter bubbles pattern already used in the app
- **Category filter**: Replace the `<Select>` dropdown with a horizontal scrollable row of chips below the type chips (only shown if categories exist)
- **Search**: Keep the search input but make it more compact on mobile
- **Tabs**: Keep as-is (already full-width grid on mobile)
- **Cards on mobile**: Use `grid-cols-2` on mobile for a denser 2-column grid instead of single column, with tighter padding
- **Empty state**: More compact on mobile

### 2. `ContentPreviewModal.tsx` — Improve modal header and close button

- Add an explicit visible close button at the top-right with a clear circular background (`bg-muted rounded-full w-8 h-8`) so it's always visible and tappable
- Use `hideClose` on `DialogContent` and render a custom close button inside the header area
- Reduce header padding on mobile (`px-4 pt-4 pb-2`)
- Make the modal full-height on mobile: `max-h-[100dvh] sm:max-h-[90vh]` with `rounded-none sm:rounded-lg`
- Doctor info card: more compact on mobile
- Ensure the content area padding is tighter on mobile

### 3. Files to modify
- `src/pages/ContentGallery.tsx`
- `src/components/content/ContentPreviewModal.tsx`

