

# Fix: Email Confirmation "Enlace Expirado" Error

## Root Cause

The Supabase JS client automatically detects the `#access_token=...` hash fragment in the URL and processes it internally, **removing it from `window.location.hash`**. By the time the `EmailConfirmed` component's `useEffect` runs, the hash is already empty (`#` or `""`), so the check `hash.includes("access_token")` fails and the page shows "Enlace expirado" -- even though the verification actually succeeded.

Meanwhile, the `onAuthStateChange` listener in `useAuthState.ts` fires a `SIGNED_IN` event and correctly redirects to `/onboarding`. But there's a race condition: the EmailConfirmed component shows the error state before the redirect happens.

## Fix

**File: `src/pages/EmailConfirmed.tsx`** -- Complete rewrite of the detection logic:

1. Remove the hash-checking approach entirely
2. Instead, use `supabase.auth.getSession()` to detect if a session was established
3. Start in "loading" state and wait for either:
   - The `onAuthStateChange` listener to redirect (which it will on `SIGNED_IN`)
   - A session check after a short delay to confirm verification worked
4. Only show "error" if after ~5 seconds there's still no session AND no redirect happened
5. The fallback timer redirects to `/onboarding` if the auth listener hasn't already done so

**Key changes:**
- Import `supabase` client
- On mount: call `supabase.auth.getSession()` after a brief delay (to let the client process the hash)
- If session found → show success, let `useAuthState` handle redirect
- If no session after timeout → show error with login button
- Keep "loading" as initial state (not "error")

This ensures the page works regardless of whether the hash is still present, and correctly handles all user roles (patient, doctor, resident) since the redirect logic in `useAuthState.ts` already checks onboarding status and role for all types.

## Files to modify
- `src/pages/EmailConfirmed.tsx` -- Rewrite session detection logic

No other files need changes -- the `useAuthState.ts` redirect logic is already correct for all roles.

