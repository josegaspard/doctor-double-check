
# Plan: Fix Onboarding Redirect on Refresh + Fix Recording Deletion

## Problem 1: Onboarding Page Appears on F5

### Root Cause
In `src/hooks/auth/useAuthState.ts` (lines 78-85), the redirect to `/onboarding` fires on both `SIGNED_IN` and `INITIAL_SESSION` events when the user is on `/` or `/login`. The issue is that `INITIAL_SESSION` fires on **every page load**, including refreshes.

Here is the likely sequence:
1. User presses F5 on any page
2. The `validateAuthSession()` call inside the `onAuthStateChange` handler sometimes fails during page load (token not yet refreshed), which calls `signOut()` and redirects to `/lives`
3. Or, the user happens to be on `/` when refreshing
4. `INITIAL_SESSION` fires, the profile loads, and if `onboardingCompleted` evaluates to falsy for any reason, it redirects to `/onboarding`

### Fix
The onboarding redirect should ONLY happen on `SIGNED_IN` events (fresh logins), NOT on `INITIAL_SESSION` (page refreshes). A user who already completed onboarding should never be redirected there on a page refresh.

**File: `src/hooks/auth/useAuthState.ts`**
- Change line 78 from:
  ```typescript
  const shouldHandleRedirectEvent = event === 'SIGNED_IN' || event === 'INITIAL_SESSION';
  ```
  to:
  ```typescript
  const shouldHandleRedirectEvent = event === 'SIGNED_IN';
  ```
- For `INITIAL_SESSION`, only redirect away from `/` and `/login` to the user's dashboard (skip the onboarding check entirely, since completed users should never see it again on refresh)
- The Onboarding page itself already has its own guard (lines 342-351) that checks `onboarding_completed` and redirects to `/lives` if already complete

---

## Problem 2: Deleting Recordings Breaks

### Root Cause
The `purchases` table has a foreign key (`purchases_recording_id_fkey`) referencing `recordings.id`. When a doctor tries to delete a recording that has been purchased, the database rejects the DELETE because of the FK constraint (no CASCADE).

### Fix

**Database Migration:**
- Alter the FK constraint on `purchases.recording_id` to add `ON DELETE CASCADE`, so deleting a recording automatically removes its purchase records
- This is safe because purchases are financial history tied to the recording -- if the recording is gone, the purchase record is no longer meaningful

Alternatively, if purchase history must be preserved:
- Change to `ON DELETE SET NULL` and make `recording_id` nullable
- This preserves the purchase record but detaches it from the deleted recording

I will use `ON DELETE SET NULL` to preserve purchase history (safer for financial data).

**Database Migration SQL:**
```sql
ALTER TABLE purchases
  DROP CONSTRAINT purchases_recording_id_fkey;

ALTER TABLE purchases
  ALTER COLUMN recording_id DROP NOT NULL;

ALTER TABLE purchases
  ADD CONSTRAINT purchases_recording_id_fkey
  FOREIGN KEY (recording_id) REFERENCES recordings(id) ON DELETE SET NULL;
```

**File: `src/pages/DoctorRecordings.tsx`**
- Also delete the recording's video file from the `recordings` storage bucket before deleting the DB row (cleanup)
- Add better error handling with specific messages for the user

---

## Summary

| Change | File/Location |
|--------|--------------|
| Restrict onboarding redirect to `SIGNED_IN` only | `src/hooks/auth/useAuthState.ts` |
| Add `INITIAL_SESSION` dashboard redirect (without onboarding check) | `src/hooks/auth/useAuthState.ts` |
| Fix FK constraint for recording deletion | Database migration (purchases table) |
| Improve delete handler with storage cleanup | `src/pages/DoctorRecordings.tsx` |
