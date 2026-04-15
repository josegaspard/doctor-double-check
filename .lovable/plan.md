

# Deep Audit Report — Medical Masters Platform

## RESUMEN EJECUTIVO

The platform is a large-scale telemedicine system with ~80 pages, ~50 edge functions, ~75 DB tables, 14 storage buckets. Architecture is fundamentally sound. The previous audit fixed the P0 stripe-webhook nesting bug, enabled HIBP, added atomic `increment_paid_chats_count` RPC, and cleaned up duplicate RLS policies.

**Current state: Deployable with caveats.** The remaining issues are functional gaps, type safety debt, and UX inconsistencies — not showstoppers.

---

## HALLAZGOS POR MÓDULO

### A. SUPER ADMIN PANEL

**What works well:**
- Dashboard metrics fetch real data via 10 parallel `count` queries
- Payout flow: Stripe + manual with receipt upload, email notifications, commission deduction, atomic `process_doctor_payout` RPC
- Invoice review: approve/reject with notes, bulk actions, period filters, CSV export
- Refund system: multi-status flow (pending→approved→processed→transferred→completed), bank transfer tracking
- Analytics: real revenue/user data from `wallet_transactions`, `purchases`, `subscriptions`, multi-period filtering
- Marketplace admin: full CRUD for products/vendors/categories/orders with sales analytics

**Issues found:**

| ID | Priority | Issue | Impact | Fix |
|----|----------|-------|--------|-----|
| A1 | P1 | Admin routes (`/admin/*`) have NO `AccessGuard` wrapper — rely only on `role !== 'admin'` redirect in `useEffect` | Admin pages briefly render before redirect for non-admins; URL manipulation shows flash of content | Wrap all 14 admin routes in `<AccessGuard allowedRoles={['admin']}>` |
| A2 | P2 | `AdminDashboard` uses `refund_requests as any` — table exists but isn't in generated types | TypeScript bypass masks potential query errors | Add `refund_requests` to types or use typed RPC |
| A3 | P2 | `AdminPayouts` breakdown double-counts earnings (fetches from `purchases` + `subscriptions` + `wallet_transactions.earning` independently) | Breakdown totals may exceed actual pending_earnings | Use only `wallet_transactions` with `type='earning'` as single source |
| A4 | P3 | `AdminPayouts.handleDeleteSelected` resets `pending_earnings=0` but doesn't create an audit trail transaction | No traceability for earnings reset | Insert a `wallet_transaction` with `type='adjustment'` |
| A5 | P2 | `AdminAnalytics` `totalRevenue` includes wallet topups + purchases + subscriptions — topups are NOT revenue (they're deposits) | Revenue inflated by non-revenue inflows | Separate "deposits" from "actual sales revenue" |

### B. DOCTOR PANEL

**What works well:**
- Dashboard with tabs (General/Analytics/Advertising), stats grid, quick actions
- Earnings page: breakdown by source (consultation/recording/subscription), monthly chart, CSV export, payout history
- Invoice upload to private `doctor-invoices` bucket, invoice preview
- Bank account form with CLABE/RFC validation
- Email stats tracking
- Office hours config, signature upload
- Patient list with vault file access

**Issues found:**

| ID | Priority | Issue | Impact | Fix |
|----|----------|-------|--------|-----|
| B1 | P2 | `DoctorDashboard` tab "Publicidad" triggers `navigate('/advertiser/dashboard')` on click instead of showing tab content | Unexpected navigation on tab click | Use inline content or remove from TabsList |
| B2 | P2 | `DoctorEarnings` calculates `totalEarnings = total_earnings + pending_earnings` but this double-counts if `total_earnings` already includes processed amounts | Inflated total shown to doctor | `totalEarnings` should just be the lifetime sum from `wallet_transactions` |
| B3 | P3 | `DoctorEarnings.commissionRate` defaults to 20% but reads from `payout_settings_public` — if view doesn't exist or is empty, doctor sees wrong commission rate | Misleading financial info | Add error handling and fallback display |

### C. FINANCIAL / ACCOUNTING

**What works well:**
- Wallet: atomic RPCs (`process_wallet_purchase`, `process_wallet_topup`, `credit_wallet_balance`)
- Consultation purchase: single atomic RPC `process_consultation_purchase` with wallet debit, entitlement upsert, doctor credit, notification
- Resident 50% discount via `get_price_for_user` RPC
- Stripe checkout flows for recordings, subscriptions, marketplace, wallet topup, consultations
- Payout processing with commission deduction

**Issues found:**

| ID | Priority | Issue | Impact | Fix |
|----|----------|-------|--------|-----|
| C1 | P1 | `AdminAnalytics` counts marketplace revenue from `marketplace_orders` but marketplace checkout goes through Stripe webhook which creates the order — if webhook fails, order isn't created but payment was taken | Revenue data could be inconsistent with actual Stripe charges | Add reconciliation: compare Stripe charges vs DB orders |
| C2 | P2 | No platform-level P&L report — admin sees individual metrics but no consolidated "Revenue - Payouts - Refunds = Net" view | Admin can't verify financial health at a glance | Add a P&L summary card to AdminAnalytics |
| C3 | P2 | Refund flow: when wallet refund is processed, balance is credited but no negative `wallet_transaction` for the original purchase is reversed | Transaction history doesn't clearly show the refund linkage | Add refund transaction with `metadata.original_transaction_id` |

### D. MARKETPLACE / ECOMMERCE

**What works well:**
- Product CRUD, vendor management, category management
- Order tracking with status flow (pending→paid→shipped→delivered)
- Featured listings with CPC/CPM tracking
- Shipping form on checkout
- My Orders page for buyers

**Issues found:**

| ID | Priority | Issue | Impact | Fix |
|----|----------|-------|--------|-----|
| D1 | P1 | 6 files use `@ts-nocheck`: `MedicalSupplies`, `AdminFeatured`, `AdminMarketplace`, `HospitalLocator`, `OrderSuccess`, `MyOrders` | All TypeScript safety disabled — runtime errors possible | Remove `@ts-nocheck`, fix type errors properly |
| D2 | P2 | `MedicalSupplies` uses `product.stock` but doesn't decrement stock on purchase | Overselling possible | Decrement stock atomically in webhook or checkout |
| D3 | P2 | No cart/multi-item checkout — each product is a separate Stripe session | Poor UX for bulk purchases | Document as known limitation or implement cart |
| D4 | P3 | Product deletion is hard delete with no soft delete | Can't recover accidentally deleted products | Add `is_active` toggle instead of DELETE |

### E. CHAT / CONSULTATIONS

**What works well:**
- Real-time messaging via Supabase Realtime
- Session management (active/closed)
- Post-consultation summary with mandatory diagnosis
- File attachments via `documents` bucket
- Consultation entitlement with 30-day expiry and upsert
- Paid chat highlighting in lives

**Issues found:**

| ID | Priority | Issue | Impact | Fix |
|----|----------|-------|--------|-----|
| E1 | P2 | Chat filter for residents defaults to `'doctors'` but resident-patient communication is blocked — filter option should not show `'patients'` for residents | Confusing empty state if resident selects 'patients' | Hide 'patients' filter for residents |

### F. LIVES / STREAMING

**What works well:**
- Daily.co integration for WebRTC
- Live setup with specialty, title, description, tags, recording price
- Viewer count tracking via RPC
- Like system
- Live chat with paid highlights
- Recording on end (local recording + upload)
- Live consultation booking

**No critical issues found.** Architecture is solid with proper cleanup on unmount.

### G. RECORDINGS & CONTENT

**What works well:**
- Purchase flow (Stripe + Wallet)
- Premium subscription discount (20%)
- Ad pre-roll before playback
- Content library with audience categorization
- Masterclass support

**No critical issues found.**

### H. VAULT & MEDICAL RECORDS

**What works well:**
- OTP verification for access
- Doctor access grants with expiry
- Storage quota tracking
- File categorization
- Clinical history with dynamic JSON

**No critical issues found.**

### I. ONBOARDING

**What works well:**
- 4-step role-based flow (patient/doctor/resident)
- Avatar upload, cedula verification, signature requirement
- Geolocation for city detection
- Phone verification via SMS OTP
- Clinical history form for patients
- Specialty selection with full 110+ list

**Issues found:**

| ID | Priority | Issue | Impact | Fix |
|----|----------|-------|--------|-----|
| I1 | P3 | Onboarding is 1593 lines in a single file | Maintenance burden | Refactor into step components (not blocking delivery) |

### J. AUTHENTICATION & SECURITY

**What works well:**
- Email/password + Google OAuth
- HIBP enabled (fixed in previous audit)
- `handle_new_user` trigger blocks admin self-registration
- `has_role` security definer function for RLS
- Session recovery for Google OAuth (6 retries)
- All 75 tables have RLS enabled

**Issues found:**

| ID | Priority | Issue | Impact | Fix |
|----|----------|-------|--------|-----|
| J1 | P1 | **14 admin routes have no `AccessGuard`** — same as A1 | Security: flash of admin content | Wrap routes |
| J2 | P2 | Realtime channels lack authorization (documented in previous audit) | Users can snoop on other channels | Complex fix — document as known risk |

### K. RESPONSIVE / MOBILE

**What works well:**
- Mobile-first design with `useIsMobile` hook
- Bottom tab navigation on mobile
- Collapsible sidebars
- Responsive grids throughout

**Issues found:**

| ID | Priority | Issue | Impact | Fix |
|----|----------|-------|--------|-----|
| K1 | P2 | `AdminMarketplace` TabsList with 5 tabs on mobile may overflow | Tabs get cut off on small screens | Use `overflow-x-auto` or reduce tab text |
| K2 | P3 | Tables in admin pages (payouts, refunds, invoices) don't have horizontal scroll wrappers | Content clips on mobile | Wrap in `overflow-x-auto` |

### L. CODE QUALITY

| ID | Priority | Issue | Impact | Fix |
|----|----------|-------|--------|-----|
| L1 | P1 | **6 files with `@ts-nocheck`** — entire marketplace module bypasses type safety | Runtime errors undetectable | Remove and fix types |
| L2 | P2 | **763 instances of `as any`** across 34 files | Reduces TypeScript value | Gradually type; prioritize financial modules |
| L3 | P3 | 343 `console.log` calls in frontend | Performance, information leakage | Gate behind `import.meta.env.DEV` |

---

## PLAN DE CORRECCIONES PRIORITIZADO

### Phase 1: Security & Critical (P0-P1) — 4 changes
1. **Wrap all 14 admin routes** in `App.tsx` with `<AccessGuard allowedRoles={['admin']}>` 
2. **Remove `@ts-nocheck`** from 6 marketplace/hospital files and fix type errors
3. **Fix `AdminAnalytics` revenue calculation** — separate deposits from actual revenue
4. **Fix marketplace stock decrement** — add atomic update in webhook

### Phase 2: Financial Accuracy (P2) — 5 changes
5. Fix `AdminPayouts` earnings breakdown double-counting
6. Fix `DoctorEarnings` total calculation
7. Add P&L summary card to AdminAnalytics
8. Add audit trail for admin earnings reset
9. Fix `DoctorDashboard` advertising tab navigation

### Phase 3: UX Polish (P2-P3) — 4 changes
10. Hide 'patients' chat filter for residents
11. Add horizontal scroll wrappers to admin tables
12. Fix AdminMarketplace tabs overflow on mobile
13. Gate console.logs behind dev mode in critical financial files

### Phase 4: Tech Debt (P3) — documented, not blocking
- Refactor 1593-line Onboarding.tsx
- Gradually reduce `as any` casts
- Add test coverage for payment flows

---

## CHECKLIST PRE-ENTREGA

| Item | Status | Action Needed |
|------|--------|---------------|
| Stripe webhook syntax | ✅ Fixed | — |
| HIBP enabled | ✅ Fixed | — |
| Atomic financial RPCs | ✅ Working | — |
| Duplicate RLS cleaned | ✅ Fixed | — |
| Admin route protection | ❌ Missing | **Phase 1** |
| @ts-nocheck removal | ❌ 6 files | **Phase 1** |
| Revenue calculation accuracy | ⚠️ Inflated | **Phase 1** |
| All core flows complete | ✅ Working | — |
| Onboarding enforcement | ✅ Working | — |
| Email notifications | ✅ Working | — |
| Mobile responsive | ✅ Good | Minor fixes in Phase 3 |

## CONCLUSIÓN

**The platform is near production-ready.** The P0 was fixed in the previous audit. Remaining P1 issues are the missing `AccessGuard` on admin routes and `@ts-nocheck` in 6 files — both straightforward fixes. Financial calculations need accuracy corrections but the core transactional logic (RPCs, webhooks, wallet) is solid and atomic.

**Estimated implementation time for Phase 1+2: ~2 hours. Phase 3: ~1 hour.**

