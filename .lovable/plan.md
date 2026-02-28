

# Plan: Fix Live Stream Access (get-daily-token + DailyVideoPlayer)

## Problem

Two bugs introduced in the last edit are preventing users from joining live streams:

1. **`getClaims()` does not exist** on the Supabase JS client. The edge function crashes with "User not authenticated" for ALL users (patients, visitors, admins).
2. **Visitors (unauthenticated)** have no auth token at all, so the function must support anonymous viewers.
3. **Duplicate DailyIframe instances** error from React StrictMode double-mounting the effect.

## Fix 1: Edge Function `get-daily-token` (supabase/functions/get-daily-token/index.ts)

- Revert `getClaims()` back to `getUser(token)` with the Authorization header passed to the client (per the stack overflow pattern)
- Make authentication **optional for viewers**: if no auth header is present AND `isOwner` is false, generate a token with a guest identity (`guest-{timestamp}`) instead of rejecting the request
- Keep the 401 response only when `isOwner` is true but no valid auth is present

## Fix 2: DailyVideoPlayer duplicate instance guard (src/components/live/DailyVideoPlayer.tsx)

- Add an `initializedRef` boolean ref that prevents `Daily.createCallObject()` from being called twice during React StrictMode's double-mount
- In the cleanup function, set `initializedRef.current = false` and properly destroy the call object
- Check `if (initializedRef.current) return;` at the start of `initCall`

## Technical Details

### get-daily-token changes:
```
- Remove getClaims() call
- Add: if no auth header AND isOwner is false -> use guest identity
- Add: if auth header present -> use getUser(token) to validate
- Keep existing Daily API token generation logic unchanged
```

### DailyVideoPlayer changes:
```
- Add: const initializedRef = useRef(false)
- In initCall: if (initializedRef.current) return; initializedRef.current = true;
- In cleanup: initializedRef.current = false;
```

| File | Change |
|------|--------|
| `supabase/functions/get-daily-token/index.ts` | Revert to getUser(), support anonymous viewers |
| `src/components/live/DailyVideoPlayer.tsx` | Guard against duplicate Daily instances |

