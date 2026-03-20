

# Plan: Fix Email History — Show count, expand/navigate, permanent delete

## Problem
- "Ver todos (X)" button doesn't show the correct count and errors when clicked
- The expand logic uses `isExpanded` toggle with a ScrollArea of fixed height that breaks
- No dedicated page for full email history when there are many emails
- Need permanent deletion from database

## Solution

### Logic change in `EmailHistoryCard.tsx`
- Show first 5 emails by default (current behavior)
- If total filtered emails ≤ 15: clicking "Ver todos (N)" expands inline WITHOUT ScrollArea height restriction — just show all items in a normal list
- If total filtered emails > 15: clicking "Ver todos (N)" navigates to `/doctor/email-history` dedicated page
- Fix: the `(N)` must show `filteredEmails.length` (already does, but the expand/ScrollArea is broken — remove the fixed `h-[400px]` and just render all when expanded for ≤15 case)
- Remove the `ScrollArea` wrapper when expanded — just render the full list directly

### New page: `src/pages/DoctorEmailHistory.tsx`
- Full-page email history with back arrow (like Notifications page)
- Fetch ALL emails from `email_history` for the doctor (no limit, or limit 500)
- Selection mode: select one, multiple, or all
- Delete selected — permanent delete from database with confirmation dialog
- Delete individual via swipe or button per row
- Filters: same type + date filters as the card
- Export CSV button
- Uses `MainLayout` + `MobileBackHeader` pattern like Notifications

### Route in `src/App.tsx`
- Add `/doctor/email-history` route pointing to the new page

### Delete behavior
- Uses `supabase.from('email_history').delete().in('id', ids)` — already works in the card
- Confirmation dialog before bulk delete
- After delete, update local state to remove deleted items

## Files to modify
1. `src/components/doctor/EmailHistoryCard.tsx` — fix expand logic, navigate when >15
2. `src/pages/DoctorEmailHistory.tsx` — new full page
3. `src/App.tsx` — add route

