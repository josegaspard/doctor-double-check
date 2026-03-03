

# Plan: Fix Invoice PDF Export and Harden CSV Export

## Problem
The PDF export in `AdminInvoiceReview.tsx` uses `window.open('', '_blank')` (line 190), which is blocked by most browser popup blockers. This is the same bug we already fixed in `AdminAnalytics.tsx`.

The CSV export works correctly but lacks an empty-data guard.

## Fix (1 file: `src/pages/AdminInvoiceReview.tsx`)

### 1. Replace `handleExportPDF` with hidden iframe approach
Instead of `window.open`, create a hidden `<iframe>`, write the HTML into it, and call `iframe.contentWindow.print()`. After printing, remove the iframe. This avoids popup blockers entirely.

The HTML content (styles, tables, summary) stays the same -- only the delivery method changes.

### 2. Add empty-data guard to both export buttons
Disable the "Excel" and "PDF Contable" buttons when `filtered.length === 0` to prevent empty exports.

### Technical approach
```text
handleExportPDF():
  1. Create iframe element (display:none)
  2. Append to document.body
  3. Write the same HTML report into iframe.contentDocument
  4. Wait 500ms for rendering
  5. Call iframe.contentWindow.print()
  6. Remove iframe after print dialog closes
```

No database changes needed. No new dependencies.
