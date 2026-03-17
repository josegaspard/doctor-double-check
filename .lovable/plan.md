

# Fix: Veriff session creation marks verification as "in progress" before user completes it

## Problem

When the user clicks "Start biometric verification", the `create-veriff-session` edge function immediately inserts a record with `status: 'pending'` into `identity_verifications`. The user is then redirected to Veriff. If they abandon the flow and return, the page sees the `pending` record and shows "Verification in progress", blocking them from retrying. The biometric flow was never completed.

## Root cause

Line 304 in `IdentityVerification.tsx`:
```tsx
const canSubmitNew = !verification || verification.status === 'failed' || verification.status === 'expired';
```
Status `pending` is NOT included, so any created-but-abandoned session blocks new attempts.

## Solution — 2 changes

### 1. `create-veriff-session/index.ts` — Delete stale pending Veriff sessions before creating new one

Before inserting a new record, delete any existing `pending` Veriff sessions for this user. This prevents accumulation of abandoned sessions and ensures only one active session exists.

```ts
// Delete any previous pending veriff sessions for this user
await supabase
  .from("identity_verifications")
  .delete()
  .eq("user_id", user.id)
  .eq("provider", "veriff")
  .eq("status", "pending");
```

### 2. `src/pages/IdentityVerification.tsx` — Allow re-verification when status is `pending`

Update `canSubmitNew` to also allow submission when the existing verification is `pending` (meaning a session was created but never completed):

```tsx
const canSubmitNew = !verification || ['failed', 'expired', 'pending'].includes(verification.status);
```

This way:
- User starts Veriff → `pending` record created → user abandons → returns → can start again
- Webhook fires with real status (`in_progress`, `verified`, `failed`) → those are respected
- `in_progress` still blocks new submissions (Veriff is actively processing)

