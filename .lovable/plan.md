

# Plan: Mobile UX Optimization + Bug Fixes

## Issues Identified

### Bug 1: Page scrolls to wrong position after navigation
No global `ScrollToTop` component exists in `App.tsx`. When navigating (e.g., clicking a premium video after payment), the browser retains scroll position, forcing users to scroll up.

**Fix**: Create `src/components/ScrollToTop.tsx` and add it inside `BrowserRouter` in `App.tsx`.

### Bug 2: City filter chips don't work in Doctors page
The city chips (CDMX, Guadalajara, etc.) set `searchQuery` which the RPC `get_doctors_paginated` searches against `name` and `specialty` columns — **not `location`**. A doctor with location "Ciudad de México" won't match "CDMX" in the name/specialty search.

**Fix**: Add a `p_location` parameter to `get_doctors_paginated` RPC function. Add a `WHERE dp.location ILIKE '%' || p_location || '%'` clause. Update the city chips to use a separate `locationFilter` state instead of `searchQuery`, and pass it to the RPC. Map chip labels to search terms (e.g., "CDMX" → search both "CDMX" and "Ciudad de Mexico").

### Bug 3: Comment threads allow infinite nesting
Current system nests up to `maxDepth=4`. Instagram uses flat threading: top-level comments + 1 level of replies, all replies collapse by default with "View N replies".

**Fix in `NewsArticle.tsx`**:
- Set `maxDepth` to 1 (replies to replies target the parent)
- Collapse all reply threads by default (start `collapsedThreads` pre-populated)
- When replying to a reply, set `parent_comment_id` to the root comment (not the reply)
- Show "View N replies" link for collapsed threads

### Improvement 4: Invoice page mobile UX
Based on the screenshots, the invoice page needs:
- Earnings summary cards: horizontal scroll on mobile instead of stacking 3 vertically
- Invoice cards: more compact layout, icon-based status instead of full badges
- Invoice guide section: collapsible on mobile to save space
- Preview modal: reduce padding, full-width buttons

**Files**: `src/pages/DoctorInvoices.tsx`, `src/components/invoices/InvoicePreviewModal.tsx`

### Improvement 5: Dashboard mobile polish
- Doctor dashboard: reduce spacing between sections, tighter card padding
- Earnings card summary: horizontal scroll grid on mobile
- Tab triggers: full-width with equal sizing

**Files**: `src/pages/DoctorDashboard.tsx`, `src/components/doctor/DoctorStatsGrid.tsx`

---

## Technical Changes

### 1. ScrollToTop component (new file)
```
src/components/ScrollToTop.tsx
```
Uses `useLocation` + `useNavigationType` to scroll to top on non-POP navigations.

### 2. App.tsx
Add `<ScrollToTop />` right after `<BrowserRouter>`.

### 3. Database migration — update `get_doctors_paginated`
Add `p_location text DEFAULT ''` parameter with:
```sql
AND (p_location = '' OR dp.location ILIKE '%' || p_location || '%')
```

### 4. Doctors.tsx
- Add `locationFilter` state separate from `searchQuery`
- City chips toggle `locationFilter` instead of `searchQuery`
- Pass `p_location` to RPC call
- Map "CDMX" chip to search for "CDMX" (the location field stores city names that should contain this)

### 5. NewsArticle.tsx — Instagram-style comments
- Reduce `maxDepth` to 1
- All threads collapsed by default
- Replies-to-replies redirect to root parent
- Cleaner "Ver N respuestas" / "Ocultar respuestas" toggle

### 6. DoctorInvoices.tsx — Mobile optimization
- Earnings summary: `flex overflow-x-auto` on mobile, `md:grid-cols-3` on desktop
- Invoice guide: wrap in `Collapsible`, collapsed by default on mobile
- Invoice cards: tighter padding, inline layout
- Upload dialog: better mobile spacing

### 7. InvoicePreviewModal.tsx — Mobile optimization
- Reduce `max-h` and padding on mobile
- Grid details: 2 columns on mobile (already done), optimize text sizes
- Full-width action buttons stacked on mobile

### 8. DoctorDashboard.tsx + DoctorStatsGrid.tsx
- Reduce vertical spacing between sections on mobile
- Tighter card padding in stats grid

