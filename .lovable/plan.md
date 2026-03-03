

# Plan: Fix Admin Analytics Data Accuracy and PDF Export

## Issues Found

### Bug 1: Purchases and Subscriptions queries ignore period filter
Lines 79-80 in `AdminAnalytics.tsx`:
- `purchases` table is queried without any date filter (`gte`), so `purchasesRevenue` and `totalPurchases` always show ALL-TIME data regardless of the selected period (Week/Month/Year).
- `subscriptions` is also queried without date filter.

**Fix**: Add `.gte('created_at', dateFromStr)` to both queries.

### Bug 2: Week period groups data by month (misleading)
When user selects "Semana" (last 4 weeks), the chart still groups by month labels (e.g., "Feb", "Mar"). This is confusing -- weekly data should show week labels.

**Fix**: When period is `week`, group by week number instead of month. Use labels like "Sem 1", "Sem 2", "Sem 3", "Sem 4".

### Bug 3: PDF popup may be blocked by browsers
`window.open('', '_blank')` is commonly blocked by popup blockers, silently failing.

**Fix**: Use a Blob + download approach (`URL.createObjectURL`) to generate and download an HTML file directly as PDF, or fall back to creating an iframe for printing. This avoids popup blockers entirely.

## Files to Modify (1)

**`src/pages/AdminAnalytics.tsx`**:
1. Add `.gte('created_at', dateFromStr)` to `purchases` and `subscriptions` queries
2. Refactor the month-grouping loop to handle weekly grouping when `period === 'week'`
3. Change PDF export from `window.open` to a Blob-based download or hidden iframe print approach

## Technical Details

### Weekly grouping logic
```text
period === 'week':
  - Loop 4 iterations (one per week)
  - Label: "Sem 1 (Feb 3-9)", "Sem 2 (Feb 10-16)", etc.
  - Filter transactions by week boundaries instead of month

period === 'month' or 'year':
  - Keep existing month grouping (unchanged)
```

### PDF fallback approach
Instead of `window.open`, create a hidden `<iframe>`, write the HTML into it, and call `iframe.contentWindow.print()`. This avoids popup blockers. After print, remove the iframe.

No database changes required.
