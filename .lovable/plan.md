

# Plan: Fix route mismatches in Veriff identity verification flow

## Issue found
The route registered in `App.tsx` is `/verify-identity`, but two places reference the wrong path `/identity-verification`:

1. **`src/pages/IdentityVerification.tsx` line 113** — `callback_url` sent to `create-veriff-session` uses `/identity-verification`
2. **`src/pages/Onboarding.tsx` line 1281** — button opens `/identity-verification` in new tab

Both will 404 when users try to use them.

## Fix
Update both references from `/identity-verification` to `/verify-identity`:

### File 1: `src/pages/IdentityVerification.tsx`
- Line 113: Change `'/identity-verification'` to `'/verify-identity'`

### File 2: `src/pages/Onboarding.tsx`
- Line 1281: Change `'/identity-verification'` to `'/verify-identity'`

Two-line fix across two files. No other changes needed.

## Note on browser testing
The verification page requires authentication. To fully test the Veriff flow end-to-end, you'll need to log in through the preview first, then navigate to `/verify-identity`. The browser automation tool shares the preview's session, so I cannot test the authenticated flow without you logging in first.

