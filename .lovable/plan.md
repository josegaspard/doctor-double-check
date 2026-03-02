
# Plan: Fix Auth Flash + Complete Web Analysis

## Part 1: Fix the "flash of logged-out state" on F5

### Root Cause
When the page refreshes, `useAuthState` initializes with `user = null` and `isLoading = true`. The `onAuthStateChange` listener fires `INITIAL_SESSION` but the profile fetch happens inside `setTimeout(..., 0)`, which means there's a brief window where:
1. `user` is `null` and `isAuthenticated` is `false`
2. `AuthenticatedProviders` renders children WITHOUT providers
3. UI components (MainLayout, AccessGuard) briefly show the logged-out state (login buttons, etc.)
4. Once the profile loads, everything re-mounts with the correct state

### Fix: Cache user profile in localStorage
On every successful profile fetch, save the `ExtendedUser` object to `localStorage`. On initialization, **immediately** restore it so `user` starts non-null for returning users. The async `onAuthStateChange` flow will then update/validate it in the background.

**Changes:**

#### `src/hooks/auth/useAuthState.ts`
- Initialize `user` state from `localStorage` cache instead of `null`:
  ```typescript
  function getCachedUser(): ExtendedUser | null {
    try {
      const cached = localStorage.getItem('mm_cached_user');
      if (cached) return JSON.parse(cached);
    } catch {}
    return null;
  }

  const [user, setUser] = useState<ExtendedUser | null>(getCachedUser());
  ```
- Wrap `setUser` to also persist to localStorage:
  ```typescript
  const setUserAndCache = (u: ExtendedUser | null) => {
    setUser(u);
    if (u) {
      localStorage.setItem('mm_cached_user', JSON.stringify(u));
    } else {
      localStorage.removeItem('mm_cached_user');
    }
  };
  ```
- Replace all internal calls to `setUser` with `setUserAndCache`
- Also update `forceSignedOutState` to clear the cache

This eliminates the flash because `isAuthenticated` will be `true` immediately on mount for returning users.

---

## Part 2: Complete Web Analysis

### A. BUGS AND ISSUES FOUND

| # | Issue | Severity | Location |
|---|-------|----------|----------|
| 1 | `useChat()` called inside `useMemo` in MainLayout (breaks Rules of Hooks -- hooks cannot be called conditionally/inside callbacks) | High | `MainLayout.tsx:166-176` |
| 2 | `AccessGuard` doesn't check `isLoading` -- shows "login required" flash during auth initialization | Medium | `AccessGuard.tsx:45` |
| 3 | `chatUnread` useMemo has empty dependency array `[]`, never updates when new messages arrive | Medium | `MainLayout.tsx:165-176` |

#### Fix for Issue #1 and #3 (MainLayout useChat violation)
Move `useChat()` to the top level of the component and compute unread count properly:
```typescript
// At component top level (not inside useMemo)
const chatContext = (() => { try { return useChat(); } catch { return null; } })();
const chatUnread = chatContext?.sessions?.reduce(...) ?? 0;
```
Actually, since `ChatProvider` may not be mounted (for unauthenticated users), the try/catch is needed. Better approach: use a safe wrapper or conditionally render.

#### Fix for Issue #2 (AccessGuard)
Add `isLoading` check:
```typescript
const { user, role, isAuthenticated, isLoading } = useAuth();
if (isLoading) return <PageLoader />;
```

### B. PERFORMANCE OPTIMIZATIONS REMAINING

| # | Optimization | Impact |
|---|-------------|--------|
| 1 | Route-based code splitting is already done (React.lazy) | Already done |
| 2 | `fetchUserProfile` makes 4-5 sequential/parallel DB calls on every auth event -- the cached user fix above reduces perceived latency | Fixed by Part 1 |
| 3 | `LivesContext` polls every 8s + realtime -- consider removing polling entirely and relying solely on realtime channel | Low priority |

### C. BUSINESS MODEL ANALYSIS BY REVENUE STREAM

#### 1. Wallet Top-Up (Variable Amount)
- **Status**: Implemented (Stripe Checkout)
- **Missing**: No minimum/maximum validation in UI, no promotional bundles (e.g., "buy $500, get $550")
- **Recommendation**: Add wallet bundle options with bonus amounts to incentivize larger top-ups

#### 2. 1:1 Consultation (Doctor-set price)
- **Status**: Implemented (wallet payment + Stripe fallback)
- **Missing**: No way for patient to see consultation history with costs; no receipt/invoice generation for patients
- **Recommendation**: Add patient transaction history view with downloadable receipts

#### 3. Double Check (Second Opinion)
- **Status**: Implemented
- **Missing**: No specific pricing differentiation from regular consultations; no tracking of how many double-checks each doctor has done
- **Recommendation**: Add a "Double Check specialist" badge for doctors with high volume

#### 4. Recording Purchases
- **Status**: Implemented (wallet + Stripe + 20% Premium discount)
- **Missing**: No "bundle" option to buy multiple recordings at discount; no preview/trailer before purchase
- **Recommendation**: Add 30-second preview clips for recordings

#### 5. Subscription Basic ($99 MXN/month)
- **Status**: Implemented
- **Missing**: 
  - No clear comparison table showing Basic vs Premium vs Free on the doctor profile page
  - Cancellation button exists but flow could be smoother
- **Recommendation**: Add a subscription comparison modal on doctor profiles

#### 6. Subscription Premium ($199 MXN/month)
- **Status**: Implemented with 20% recording discount + priority chat
- **Missing**:
  - Early access to lives (mentioned in audit but not implemented)
  - Exclusive content filter (premium-only content not clearly differentiated in UI)
- **Recommendation**: Implement early_access_minutes and premium content badges

#### 7. Platform Commission (20% default)
- **Status**: Implemented via payout_settings
- **Missing**:
  - No admin dashboard chart showing commission revenue over time
  - No breakdown by revenue source (consultations vs subscriptions vs recordings)
- **Recommendation**: Add commission breakdown chart in AdminAnalytics

### D. MISSING FEATURES FOR OPTIMAL REVENUE

| Priority | Feature | Revenue Impact |
|----------|---------|---------------|
| HIGH | Patient transaction history with receipts | Trust + retention |
| HIGH | Subscription comparison table on doctor profiles | Conversion |
| HIGH | Premium early access to lives (5 min) | Premium upsell |
| MEDIUM | Wallet bonus bundles ($500 gets $550) | Higher ARPU |
| MEDIUM | Recording preview clips (30s trailer) | Purchase conversion |
| MEDIUM | Commission breakdown in admin analytics | Business intelligence |
| LOW | Doctor "Double Check specialist" badge | Feature discovery |
| LOW | Premium-only content badges | Content differentiation |

### E. UX ISSUES

| # | Issue | Impact |
|---|-------|--------|
| 1 | No empty state illustration for pages with no data (just blank) | User confusion |
| 2 | No skeleton loaders on doctor profile cards during loading | Perceived slowness |
| 3 | Chat unread badge never updates in navigation (dependency array bug) | Missed messages |
| 4 | No "pull to refresh" on mobile for lives/recordings | Mobile UX |

---

## Implementation Summary (What will be coded NOW)

| # | Task | Files |
|---|------|-------|
| 1 | Cache user profile in localStorage to eliminate auth flash | `src/hooks/auth/useAuthState.ts` |
| 2 | Fix AccessGuard to show loader during auth init | `src/components/AccessGuard.tsx` |
| 3 | Fix useChat() hook violation in MainLayout | `src/components/layout/MainLayout.tsx` |

The business model analysis and remaining optimizations are presented above for future reference -- they don't require immediate code changes.
