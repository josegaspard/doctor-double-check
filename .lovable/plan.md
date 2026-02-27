

# Plan: Fix Doctor News Access, WebRTC Call Connection, and Live Cleanup

## Issue 1: Doctor News Article Page Redirects

**Root cause:** `AdminNews.tsx` initializes `permissionLoading` based on `role === 'doctor'`, but during initial render, `role` may still be `null` (auth loading). This means `permissionLoading` is `false` AND `canPublish` is `false`, so the redirect at line 200 fires immediately before the permission check ever runs.

**Fix in `src/pages/AdminNews.tsx`:**
- Change `permissionLoading` initialization to `true` unconditionally (instead of only when `role === 'doctor'`)
- In the `useEffect`, handle ALL cases: set `permissionLoading = false` for admins (they always can), for doctors (after DB check), and for other roles
- Add `role` to the effect dependencies so it re-runs when auth finishes loading
- Remove the `(data as any)` cast since `can_publish_news` exists in the types

## Issue 2: WebRTC 1:1 Call Stuck on "Connecting"

**Root cause:** `setupSignaling` calls `supabase.channel().subscribe()` but never waits for the `SUBSCRIBED` callback. The 1000ms `setTimeout` is unreliable -- the channel may not be subscribed yet, so broadcasts are lost. Both the doctor's offer and the patient's `ready` signal can be sent into the void.

**Fix in `src/hooks/useWebRTCCall.ts`:**
- Modify `setupSignaling` to return a Promise that resolves only when the channel status is `SUBSCRIBED`
- In `startCall` and `joinCall`, `await` this promise instead of using a `setTimeout`
- After confirmed subscription, the doctor sends the offer and the patient sends the `ready` signal
- Add a timeout (8 seconds) so the call doesn't hang forever if subscription fails -- transition to `error` state

## Issue 3: Ended Live Still Visible in /lives Grid

**Root cause:** The realtime subscription in `LivesContext.tsx` correctly updates the live's status to `ended`. The grid filter `l.status === 'live'` should exclude it. However, the `LiveEndedOverlay` modal now navigates users to `/lives` after 5 seconds, which is correct. The live disappearing from the grid relies on the realtime update propagating correctly.

The actual issue is that when the doctor ends the live from the LivePlayer page (via `endLive`), the database update triggers a realtime event. The `LivesContext` handler at line 382 updates the live in place with the new status. The `LivesGrid` filter then excludes it. This flow should work. To ensure robustness:

**Fix in `src/contexts/LivesContext.tsx`:**
- In the realtime handler for `UPDATE`, if the new status is `ended`, remove the live from the array entirely rather than just updating it (so the filter doesn't even need to work)

---

## Technical File Changes

| File | Change |
|------|--------|
| `src/pages/AdminNews.tsx` | Initialize `permissionLoading = true` always; handle all role cases in useEffect; remove `as any` cast |
| `src/hooks/useWebRTCCall.ts` | Make `setupSignaling` return a Promise resolving on `SUBSCRIBED`; await it in `startCall`/`joinCall`; add 8s timeout |
| `src/contexts/LivesContext.tsx` | In realtime UPDATE handler, remove lives with status `ended` from array instead of updating them |

