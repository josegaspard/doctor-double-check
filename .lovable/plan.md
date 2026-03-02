

# Plan: Vertical Recording Playback, Price Input Fix, Resident User, Session Stability, OAuth Guide, and Favicon

## 1. Fix vertical recording playback (black side margins)

The screenshot shows a mobile-recorded live displayed stretched horizontally with `aspect-[9/16]` on desktop, which looks wrong. The correct approach: always use `aspect-video` (16:9 container) and let `object-contain` handle vertical videos by adding black side margins automatically.

### Changes to `src/components/recordings/CloudflareRecordingPlayer.tsx` (line 312):
- Change `aspect-[9/16] sm:aspect-video` to just `aspect-video`
- Keep `object-contain` on the video element (already correct)
- This ensures vertical recordings show centered with black side margins

### Changes to `src/components/recordings/RecordingVideoPlayer.tsx` (line 93):
- Same fix: change `aspect-[9/16] sm:aspect-video` to `aspect-video`

### Changes to `src/pages/RecordingPlayer.tsx` (line 235):
- The fallback "no video" state already uses `aspect-video` -- no change needed

## 2. Fix "Precio de grabacion" input (remove default 0)

The `recordingPrice` state is already initialized as `''` (empty string) from the last diff. The `value` prop passes this correctly and the placeholder shows "0 = gratuita". However, the `onFocus` behavior should clear any "0" value if the user somehow typed it and wants to replace it.

### Changes to `src/components/live/LiveSetupForm.tsx` (lines 237-245):
- Add `onFocus` handler that clears the value if it's `0`
- This ensures tapping the input on mobile immediately clears the zero

## 3. Create resident test user

The `seed-demo-users` edge function already creates 10 residents (`residente1@medicalmasters.test` through `residente10@medicalmasters.test`, password `Demo1234!`). I will invoke this function to ensure the users exist.

### Action:
- Call the `seed-demo-users` edge function to create/verify resident users
- Provide credentials to the user

## 4. Strengthen session persistence

The auth state already has the dual-check (getUser -> getSession fallback) from the last edit. Additional hardening:

### Changes to `src/hooks/auth/useAuthState.ts`:
- In the `onAuthStateChange` callback, add a guard: only call `forceSignedOutState` for `SIGNED_OUT` events, not for `TOKEN_REFRESHED` or other events that may temporarily have no session
- Add `try/catch` around `fetchUserProfile` to prevent a network error from triggering sign-out
- Add a `TOKEN_REFRESHED` handler that silently updates `supabaseUser` without re-validating

## 5. Google OAuth Consent Screen guidance

This is a configuration-only item (no code changes). I will provide step-by-step instructions in the response:
1. In the Google Cloud Console, go to "Informacion de la marca" (left sidebar)
2. Upload your logo there
3. Fill app name as "Medical Masters"
4. Save and proceed to create OAuth credentials

## 6. Favicon change

The user wants to change the favicon. I need them to provide an image file. The current `index.html` references `/favicon.ico`. Once they provide the image, I will copy it to `public/` and update `index.html`.

### Action:
- Ask the user to provide/upload their desired favicon image

## 7. Mobile UX audit pass

Quick review of key mobile patterns already in place. No major changes needed beyond the fixes above, but I will verify:
- Recording player containers use proper aspect ratios
- Touch targets are at least 44px
- LiveSetupForm inputs work well on mobile (the price fix addresses this)

## Summary of code changes

| File | Change |
|------|--------|
| `src/components/recordings/CloudflareRecordingPlayer.tsx` | Change `aspect-[9/16] sm:aspect-video` to `aspect-video` for proper vertical video display |
| `src/components/recordings/RecordingVideoPlayer.tsx` | Same aspect ratio fix |
| `src/components/live/LiveSetupForm.tsx` | Add `onFocus` to clear "0" from price input |
| `src/hooks/auth/useAuthState.ts` | Guard against false sign-outs on TOKEN_REFRESHED events and network errors during profile fetch |
| Edge function call | Invoke `seed-demo-users` to create resident test users |

