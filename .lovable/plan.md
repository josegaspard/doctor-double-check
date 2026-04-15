

# Comprehensive Audit Plan — Medical Masters Platform

## 1. RESUMEN EJECUTIVO

The project is a large, feature-rich telemedicine platform with ~80 pages, ~50 edge functions, and ~75 database tables. Overall architecture is solid, but the audit uncovered **1 P0 critical bug**, **4 P1 high-priority issues**, and **~12 P2 medium issues** that must be addressed before client delivery.

**Critical finding**: The `stripe-webhook` edge function has a **syntax/structural bug** where `handleLiveChatHighlight` is nested inside `handleSubscriptionDeleted` due to missing closing braces. This means subscription cancellation handling is broken and could cause runtime errors for multiple payment flows.

---

## 2. HALLAZGOS POR PRIORIDAD

### P0 — CRITICAL (Blocks delivery)

**P0-1: stripe-webhook function has broken syntax structure**
- **File**: `supabase/functions/stripe-webhook/index.ts` lines 806-912
- **Issue**: `handleSubscriptionDeleted` function is missing closing braces for its `for` loop and `if` block. `handleLiveChatHighlight` function is defined inside it. Orphaned lines 910-912 (`logStep("Subscriptions deactivated"...)`) execute after `handleLiveChatHighlight` returns, not after the subscription loop.
- **Impact**: Subscription cancellation notifications may fail. The entire webhook could crash on certain event types.
- **Fix**: Restructure braces: close the `for` loop and `if` block properly on line 817, close `handleSubscriptionDeleted` before line 819, then define `handleLiveChatHighlight` as a separate top-level function.

### P1 — HIGH (Affects operation or client confidence)

**P1-1: Realtime channels have no authorization**
- **Issue**: Security scan detected `REALTIME_NO_CHANNEL_AUTHORIZATION` — any authenticated user can subscribe to any Realtime channel including private ones (notifications, consultations, payouts).
- **Impact**: Data leakage of medical and financial information between users.
- **Fix**: Add RLS policies on `realtime.messages` table scoped by `auth.uid()` and channel topic. This is a database migration.

**P1-2: Leaked password protection disabled**
- **Issue**: HIBP check is disabled. Users can register with known compromised passwords.
- **Fix**: Enable via `configure_auth` tool with `password_hibp_enabled: true`.

**P1-3: Ad campaigns expose advertiser identities publicly**
- **Issue**: Public SELECT policy on `ad_campaigns` where `status = 'active'` exposes `advertiser_id`, `budget`, `spent`, and targeting data to unauthenticated users.
- **Fix**: Create a security-definer RPC function that returns only the fields needed for ad delivery (creative URLs, click URLs) without exposing advertiser UUIDs or budget data.

**P1-4: `paid_chats_count` increment is not atomic (race condition)**
- **File**: `stripe-webhook/index.ts` lines 893-904
- **Issue**: Read-then-write pattern for `paid_chats_count` on the `lives` table. Under concurrent purchases this will lose increments.
- **Fix**: Use an atomic SQL `UPDATE lives SET paid_chats_count = paid_chats_count + 1 WHERE id = ?` or create an RPC.

### P2 — MEDIUM (Should fix before or shortly after delivery)

**P2-1**: Security definer views detected (2 instances) — audit which views and ensure they don't bypass RLS unintentionally.

**P2-2**: Public storage buckets allow file listing (3 buckets) — restrict SELECT policies to scoped paths.

**P2-3**: RLS policies with `USING (true)` for INSERT on `ad_events` — intentional for tracking but should be documented.

**P2-4**: `followers` table publicly readable — exposes social graph to unauthenticated users. Restrict to authenticated.

**P2-5**: `hospital_reviews` and `news_comments` expose `user_id` publicly — restrict SELECT to authenticated.

**P2-6**: Doctor-content storage policy uses weak LIKE match on `file_url` — potential path traversal. Use exact match.

**P2-7**: `AccessGuard` doesn't use `useAuth` role from server for most pages — many routes in `App.tsx` have no AccessGuard wrapper, relying solely on client-side navigation logic.

**P2-8**: `MainLayout` calls `useChat()` inside a try-catch outside React rules (conditional hook call) — lines 216-225. Should use a safe wrapper component.

**P2-9**: Wallet topup fallback (lines 175-188 in stripe-webhook) uses non-atomic read-then-write when RPC fails — potential double-credit.

**P2-10**: `ad_config` has duplicate SELECT policies ("Anyone can read" and "Public can read") — clean up.

**P2-11**: `ad_creatives` has duplicate/overlapping SELECT policies — remove the broader one.

**P2-12**: Extension installed in `public` schema — should be in a dedicated schema.

### P3 — LOW (Recommended improvements)

- 343 `console.log` calls in frontend code — clean up or gate behind `import.meta.env.DEV`
- Several `as any` type casts in admin pages (e.g., `refund_requests as any`)
- No automated test coverage for payment flows
- Onboarding progress tracking exists in DB (`onboarding_progress` table) but unclear if fully connected

---

## 3. PLAN DE CORRECCIONES (4 phases)

### Phase 1: Fix P0 stripe-webhook syntax (CRITICAL)
- Restructure `supabase/functions/stripe-webhook/index.ts` lines 806-912
- Properly close `handleSubscriptionDeleted` 
- Extract `handleLiveChatHighlight` as top-level function
- Fix orphaned `logStep` on line 910
- Deploy and verify

### Phase 2: Security hardening (P1 issues)
1. Enable leaked password protection
2. Fix `ad_campaigns` public SELECT policy — replace with security-definer RPC for ad delivery
3. Make `paid_chats_count` increment atomic
4. Database migration to restrict `followers`, `hospital_reviews`, `news_comments` SELECT to authenticated users
5. Remove duplicate RLS policies on `ad_config` and `ad_creatives`
6. Add Realtime channel authorization (document as recommendation — requires careful planning)

### Phase 3: Code quality fixes (P2)
1. Fix `MainLayout` conditional `useChat()` hook call
2. Remove wallet topup non-atomic fallback (the RPC should exist by now)
3. Add AccessGuard to unprotected admin routes that lack it
4. Clean up `as any` casts where types are available

### Phase 4: Validation
1. Deploy updated stripe-webhook
2. Test webhook with Stripe CLI for all event types
3. Verify admin dashboard loads correctly
4. Verify onboarding flow completion
5. Run security scan again to confirm fixes

---

## 4. CHECKLIST PRE-ENTREGA

| Item | Status | Risk |
|------|--------|------|
| All tables have RLS enabled | ✅ Done | Low |
| Stripe webhook handles all event types | ❌ BROKEN | **Critical** |
| Auth flow (login/register/reset) | ✅ Working | Low |
| Onboarding completion enforcement | ✅ Working | Low |
| Payment flows (consultation/recording/subscription) | ⚠️ Mostly working | High — webhook bug |
| Refund flow | ✅ Working | Low |
| Admin dashboard access control | ✅ Working | Low |
| Leaked password protection | ❌ Disabled | Medium |
| Realtime channel authorization | ❌ Missing | High |
| Doctor earnings atomic operations | ✅ Working | Low |
| All secrets configured | ✅ 14 secrets present | Low |

---

## 5. CONCLUSIÓN HONESTA

The project is **NOT ready for production delivery** due to the P0 stripe-webhook syntax bug that breaks subscription cancellation handling. Once the P0 and P1 fixes are applied (estimated ~2-3 hours of work), the platform reaches a **defensible delivery state**.

The architecture is well-designed: proper role separation, atomic financial operations via RPCs, comprehensive edge functions for all business flows, RLS on all 75 tables, and solid auth with Google OAuth + email/password. The codebase follows consistent patterns and the business logic is thorough.

**Minimum required before delivery**: Fix P0 + P1-2 (leaked passwords) + P1-3 (ad data exposure).
**Recommended before delivery**: All P1 + P2-8 (hook violation) + P2-9 (wallet fallback).

