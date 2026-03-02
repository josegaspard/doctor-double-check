
# Plan: Add "Load More" Pagination to Patient Reviews

## Approach

A **"Load More" button** is the best UX pattern here rather than numbered pagination. It keeps the user in context (no page jumps), works naturally on mobile with thumb scrolling, and is the standard pattern used by review sections on platforms like Google Maps, Airbnb, and App Store.

## Changes

### File: `src/components/doctor/DoctorReviews.tsx`

1. **Fetch total count** -- Add a separate count query to know the total number of reviews for this doctor (used to show "X of Y reviews" and hide the button when all are loaded).

2. **Increase initial limit from 20 to fetch-all approach with batched display** -- Keep fetching all reviews upfront (they're small records), but only *display* 10 at a time via a `visibleCount` state. This avoids extra network calls on each "load more" click.

3. **Add `visibleCount` state** -- Starts at `10`. Each click adds 10 more. The "Load More" button hides when `visibleCount >= reviews.length`.

4. **Render only `reviews.slice(0, visibleCount)`** instead of all reviews.

5. **Add "Load More" button** at the bottom of the reviews list:
   - Styled as a subtle outline button, full-width on mobile, centered on desktop
   - Shows remaining count: e.g., "Show more reviews (15 remaining)"
   - Smooth appearance with no layout shift

6. **Show review count summary** -- Below the average rating, display "Showing X of Y reviews" when not all are visible.

7. **Remove the `.limit(20)` cap** from the query (or raise to 100) so doctors with many reviews can see them all progressively.

## Technical Details

```tsx
// New state
const [visibleCount, setVisibleCount] = useState(10);

// Slice for display
const visibleReviews = reviews.slice(0, visibleCount);
const hasMore = visibleCount < reviews.length;

// Load more handler
const handleLoadMore = () => setVisibleCount(prev => prev + 10);

// Button at bottom of CardContent
{hasMore && (
  <Button
    variant="outline"
    className="w-full mt-2"
    onClick={handleLoadMore}
  >
    {t('doctorProfile.showMoreReviews')} ({reviews.length - visibleCount})
  </Button>
)}
```

### File: `src/lib/i18n/es.ts` and `src/lib/i18n/en.ts`

Add keys:
- `doctorProfile.showMoreReviews` -- "Show more reviews" / "Ver mas resenas"
- `doctorProfile.showingReviews` -- "Showing {count} of {total}" / "Mostrando {count} de {total}"

## Files Modified

| File | Change |
|------|--------|
| `src/components/doctor/DoctorReviews.tsx` | Add visibleCount state, slice display, "Load More" button, raise query limit |
| `src/lib/i18n/en.ts` | Add 2 i18n keys |
| `src/lib/i18n/es.ts` | Add 2 i18n keys |
