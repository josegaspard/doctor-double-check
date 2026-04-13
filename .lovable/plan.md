

# Audit Results: Transactions, Accounting & Error Analysis

## Issues Found

### CRITICAL: Marketplace revenue missing from Admin Analytics
**File:** `src/pages/AdminAnalytics.tsx`

The admin global analytics dashboard (`/admin/analytics`) tracks wallet transactions, purchases (recordings), subscriptions, and consultations — but does NOT query `marketplace_orders` at all. This means marketplace product sales (the entire e-commerce flow) are invisible in the super admin's main analytics dashboard.

**Fix:** Add a query for `marketplace_orders` (status != 'pending' and != 'cancelled'), sum `total_amount` as `marketplaceRevenue`, and include it in `grossRevenue` calculation and the revenue chart breakdown.

### MODERATE: Console warning — forwardRef on InvoicePreviewModal
**File:** `src/components/invoices/InvoicePreviewModal.tsx`

The `DoctorInvoices` page passes a ref to `InvoicePreviewModal` (or to `Dialog`), but neither uses `React.forwardRef()`. This causes a React warning in console. Not a crash, but noisy.

**Fix:** Wrap `InvoicePreviewModal` with `React.forwardRef` or remove the ref pass in `DoctorInvoices.tsx`.

### LOW: Ad events INSERT policy is `true` (always true)
**Tables:** `ad_events`

Two INSERT policies use `WITH CHECK (true)` — this is intentional for anonymous ad tracking (impressions/clicks), so no fix needed. Already reviewed and acceptable.

### LOW: Security Definer Views
The linter flags 2 views with SECURITY DEFINER. These were previously reviewed (payout_settings_public, profiles_public) and are intentionally designed this way. No action needed.

---

## Verified Working (No Issues)

| Flow | Status | Details |
|------|--------|---------|
| Marketplace checkout (Stripe) | ✅ | `create-marketplace-checkout` creates order + decrements stock |
| Stripe webhook → order paid | ✅ | `handleMarketplacePurchase` updates status, sends email, notifies admins |
| Purchase confirmation email | ✅ | `send-purchase-email` handles purchase/shipped/delivered types |
| Admin status change → email | ✅ | `updateStatus` in OrdersTab fetches buyer email and triggers email |
| Admin tracking number save | ✅ | Saves to `marketplace_orders.tracking_number` |
| Admin CSV export | ✅ | Exports filtered orders with all relevant fields |
| Admin SalesTab analytics | ✅ | Revenue, vendor breakdown, top products, monthly chart |
| MyOrders user view | ✅ | Filters, timeline, tracking, search all working |
| OrderSuccess thank you page | ✅ | Confetti + order summary + navigation |
| Wallet transactions RLS | ✅ | SELECT only (no INSERT for users), server-side only |
| marketplace_orders RLS | ✅ | Buyer sees own, admin sees all, vendor sees own |
| Consultation purchase flow | ✅ | Atomic via `process_consultation_purchase` RPC |
| Recording purchase flow | ✅ | Via `purchase-recording-wallet` edge function |
| Subscription flow | ✅ | Via Stripe checkout + webhook |
| Wallet topup flow | ✅ | Via `process_wallet_topup` RPC |
| Doctor earnings tracking | ✅ | `pending_earnings` and `total_earnings` on doctor_profiles |
| Doctor payouts | ✅ | Admin payout flow with `process_doctor_payout` RPC |
| Refund system | ✅ | Multi-channel via `admin-refund` edge function |

---

## Plan

### 1. Add marketplace revenue to AdminAnalytics
**File:** `src/pages/AdminAnalytics.tsx`

- Add query: `supabase.from('marketplace_orders').select('total_amount, created_at, quantity').in('status', ['paid', 'shipped', 'delivered'])`
- Add `marketplaceRevenue` to analytics state
- Include in `grossRevenue` calculation
- Add marketplace breakdown in monthly chart data
- Add a new summary card for "Ventas Marketplace"

### 2. Fix InvoicePreviewModal forwardRef warning
**File:** `src/pages/DoctorInvoices.tsx` or `src/components/invoices/InvoicePreviewModal.tsx`

- Check how InvoicePreviewModal is rendered in DoctorInvoices
- Either wrap with forwardRef or remove the ref usage to eliminate the console error

### 3. No database changes needed
All RLS, tables, and edge functions are correctly configured. No migration required.

---

## Technical Summary

| # | What | File | Priority |
|---|------|------|----------|
| 1 | Add marketplace revenue to admin analytics | `AdminAnalytics.tsx` | Critical |
| 2 | Fix forwardRef warning on InvoicePreviewModal | `DoctorInvoices.tsx` / `InvoicePreviewModal.tsx` | Low |

Everything else — e-commerce, wallet, subscriptions, consultations, recordings, payouts, emails, RLS — is verified complete and functional.

