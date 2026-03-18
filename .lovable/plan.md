

# Plan: Fix Push Notifications, Activate Biometric Verification & SEP Flow

## Problem Analysis

### 1. Push Notifications — "push service error"
The error `Registration failed - push service error` happens because the VAPID public key used in the frontend (`usePushNotifications.ts` line 6) is a **hardcoded fallback** that likely doesn't match the `VAPID_PRIVATE_KEY` secret stored in the backend. The `.env` file has no `VITE_VAPID_PUBLIC_KEY`, so it always falls back to the hardcoded value. Additionally, the `applicationServerKey: applicationServerKey.buffer as ArrayBuffer` cast on line 98 can fail in some browsers — should pass `Uint8Array` directly.

**Fix:**
- Add `VITE_VAPID_PUBLIC_KEY` to the `.env` file with the correct value from the backend secret, OR fetch the VAPID public key from a simple edge function that reads the secret.
- Since we can't read the secret value, and the `.env` is auto-generated and shouldn't be edited, the best approach is: create a tiny edge function `get-vapid-key` that returns the `VAPID_PUBLIC_KEY` secret, then use it in the frontend. Alternatively, we can just remove the `.buffer` cast (pass `Uint8Array` directly) and ensure the hardcoded key is correct.
- Actually, the simplest fix: remove `.buffer as ArrayBuffer` — pass the `Uint8Array` directly to `pushManager.subscribe`. Many modern browsers reject `ArrayBuffer` but accept `Uint8Array`. This is the most likely cause of the "push service error".

### 2. Biometric Verification — "Coming Soon" in Settings  
The Settings page (`Settings.tsx` lines 309-315) shows the identity verification card with a "coming soon" message and a non-functional button. The actual working verification flow exists at `/identity-verification` (`IdentityVerification.tsx`) with full Veriff integration.

**Fix:**
- Make the "Iniciar verificación" button in Settings navigate to `/identity-verification`
- Remove the "coming soon" text
- Show actual verification status (fetch from `identity_verifications` table)

### 3. SEP + Biometric Combined Flow
The user wants the full flow to be:
1. First verify SEP professional license (already works via `verify-cedula-sep` edge function)
2. Then verify biometrically that the person matches the SEP/INE (already works via Veriff at `/identity-verification`)

The identity verification page should mention this combined flow more clearly.

---

## Files to Modify

### `src/hooks/usePushNotifications.ts`
- Line 96-98: Change `applicationServerKey: applicationServerKey.buffer as ArrayBuffer` → `applicationServerKey: applicationServerKey` (pass Uint8Array directly)
- This fixes the "push service error" in modern browsers

### `src/pages/Settings.tsx`  
- Make the "Iniciar verificación" button navigate to `/identity-verification` instead of doing nothing
- Remove the "coming soon" text
- Query actual verification status to show correct badge (verified/pending/none)

### `src/pages/IdentityVerification.tsx`
- Add a note about the combined flow: first SEP license verification, then biometric identity check
- The page already has the full Veriff flow working; just needs contextual text updates

### `src/lib/i18n/es.ts` and `src/lib/i18n/en.ts`
- Remove/update the `verificationComingSoon` string
- Add proper navigation labels

---

## Implementation Order
1. Fix push notifications (Uint8Array fix in `usePushNotifications.ts`)
2. Activate identity verification button in Settings (navigate to `/identity-verification`)
3. Update identity verification page text to reflect the SEP + biometric combined flow

