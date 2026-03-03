
# Plan: Fix Incoming Call Persistence, Session Stability, Live Thumbnail

## Issue 1: Incoming Call Modal Persists After Answering

**Root cause**: When the patient clicks "Accept", `handleAccept` calls `onClose()` (which is `dismissCall`) and navigates to `/video-call`. However, the `notifChannel` keeps listening for `postgres_changes` on the `notifications` table. If there are multiple notification inserts for the same call (broadcast + DB notification arriving at different times), the modal can re-appear because the dismissed ID is only tracked in a `useRef` that gets lost when the component unmounts/remounts during navigation.

Additionally, `dismissCall` only marks notifications of type `video_call` as read, but doesn't filter by the specific `consultationId`, so if the timing is off the notification INSERT event fires before the dismiss completes.

**Fix in `useIncomingCall.ts`**:
- When the user navigates to `/video-call`, auto-dismiss any incoming call for that consultation by checking the current URL path
- Add the consultationId to the dismissed set BEFORE navigating (already done, but also persist dismissed IDs to `sessionStorage` so they survive navigation/remount)
- On the notification channel listener, also check if the user is already on the `/video-call` page -- if so, suppress the modal entirely
- Delete the `video_call` notification row (not just mark as read) to prevent the realtime INSERT from retriggering on other channels

**Fix in `IncomingCallModal.tsx`**:
- No changes needed, the issue is in the hook

## Issue 2: Random Session Logout on Mobile

**Root cause**: In `useAuthState.ts`, line 109: when `fetchUserProfile` returns `null` (which can happen due to transient RLS/network errors), the code calls `supabase.auth.signOut()` and clears the session. On mobile browsers, network is less reliable, so `fetchUserProfile` fails more often.

The problematic flow:
1. `onAuthStateChange` fires (e.g. `TOKEN_REFRESHED` is skipped, but `INITIAL_SESSION` is not)
2. `fetchUserProfile` throws or returns null due to a momentary network glitch
3. Code treats this as "profile missing" and signs out

**Fix in `useAuthState.ts`**:
- When `fetchUserProfile` returns `null`, don't immediately sign out. Instead, retry once after a short delay (2 seconds)
- If retry also fails, check if there's a cached user in localStorage -- if so, keep the session alive and just log a warning
- Only force sign-out if the profile is genuinely missing (multiple retries fail AND no cached user exists)
- Add a `retryCount` guard to prevent infinite loops

## Issue 3: Live Card Thumbnail Not Showing

**Root cause**: The storage upload policy for the `thumbnails` bucket requires the first folder in the path to be the user's UUID: `(auth.uid())::text = (storage.foldername(name))[1]`. But the code uploads to `live-thumbnails/${user.id}/timestamp.jpg`, where folder[1] = `live-thumbnails` (not the UUID). This causes the upload to silently fail (the error is caught but thumbnailUrl stays null).

**Verified**: All lives in the DB have `thumbnail_url = null` despite users uploading images.

**Fix in `DoctorGoLive.tsx`**:
- Change the upload path from `live-thumbnails/${user.id}/...` to `${user.id}/live-${Date.now()}.${ext}` so the first folder matches the RLS policy

This is a one-line fix that will make all future thumbnail uploads work.

---

## Files to modify (3)

1. **`src/hooks/useIncomingCall.ts`** -- Persist dismissed IDs in sessionStorage; suppress modal when already on video-call page; delete notification row on dismiss
2. **`src/hooks/auth/useAuthState.ts`** -- Add retry logic for fetchUserProfile before signing out; use cached user as fallback
3. **`src/pages/DoctorGoLive.tsx`** -- Fix thumbnail upload path to match storage RLS policy

**No database migrations needed.**
