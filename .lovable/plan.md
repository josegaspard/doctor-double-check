

# Plan: Fix Call Banner, Track Subscription Revenue, and Real-Time Lives

## 1. Fix CallWaitingBanner persistence

**Problem**: When the doctor ends a video call, the `video_room_name` field on the `consultations` table is never cleared. The `ChatMessagesPanel` checks `!!data?.video_room_name` to decide whether to show the banner, so it stays visible permanently after any call.

**Solution**: In `useWebRTCCall.ts`, after the doctor ends the call (in `endCall`), clear the `video_room_name` and `video_room_url` fields on the consultation row by setting them to `null`. This will trigger the realtime subscription in `ChatMessagesPanel` which already listens for `UPDATE` on consultations, causing the banner to disappear immediately.

**File**: `src/hooks/useWebRTCCall.ts`
- In the `endCall` callback, after invoking `end-daily-room`, add:
  ```typescript
  await supabase.from('consultations').update({
    video_room_name: null,
    video_room_url: null,
  }).eq('id', consultationId);
  ```

---

## 2. Track Pro subscription payments as platform revenue

**Problem**: Pro (basic/premium) subscription payments are credited to the doctor's `pending_earnings` via `creditDoctorEarningsAtomic`, but after platform commission is applied, the admin dashboard should also reflect subscription revenue in its breakdown. Currently, `handleCreatorSubscription` already calls `creditDoctorEarningsAtomic` which credits the full `tierPrice` to the doctor.

**Analysis**: Looking at `stripe-webhook/index.ts` line 313, the subscription handler already credits doctor earnings atomically and creates a `wallet_transactions` entry with `source: "subscription"`. The admin payout system already reads from `doctor_profiles.pending_earnings` and `wallet_transactions`.

**What's missing**: The admin analytics/payout breakdown needs to recognize `subscription` as a revenue source. Let me check the admin analytics page.

**File**: `supabase/functions/stripe-webhook/index.ts`
- The `handleCreatorSubscription` function (line 253-314) already credits doctor earnings correctly with `source: "subscription"`.
- The `handleInvoicePaymentSucceeded` renewal handler (line 670-738) also credits with `source: "subscription_renewal"`.
- Both already create `wallet_transactions` with the proper metadata.

No changes needed in the webhook -- the earnings are already tracked. However, I need to verify the admin dashboard displays subscription revenue correctly.

**Files to check/update**: `src/pages/AdminAnalytics.tsx`, `src/pages/AdminPayouts.tsx` -- ensure they include subscription-type transactions in their revenue breakdowns.

---

## 3. Real-time lives appearing on /lives without refresh

**Problem**: The user wants new lives from ANY doctor (not just followed ones) to appear in real-time on the `/lives` grid.

**Analysis**: Looking at `LivesContext.tsx`, the realtime subscription on lines 358-457 already handles this. It listens for `INSERT`/`UPDATE`/`DELETE` on the `lives` table and updates state directly, including fetching doctor profile data for new lives. The `LivesGrid.tsx` component already uses `AnimatePresence` for smooth entry/exit animations.

**Verification**: The `lives` table is already in `supabase_realtime` publication (the realtime channel subscribes to `postgres_changes` on `lives`). The INSERT handler (lines 401-428) creates the live entry immediately and asynchronously hydrates the doctor profile.

**This should already work.** If it's not working, it could be because:
1. The `lives` table wasn't added to the realtime publication
2. RLS policies block the realtime subscription for anonymous/patient users

**Action**: Run a database migration to ensure `lives` is in the realtime publication (it may already be, but this is idempotent). Also verify RLS allows SELECT for all users on the `lives` table.

---

## Summary of Changes

| # | Task | Files |
|---|------|-------|
| 1 | Clear `video_room_name` on call end | `src/hooks/useWebRTCCall.ts` |
| 2 | Verify subscription revenue tracking in admin views | `src/pages/AdminAnalytics.tsx`, `src/pages/AdminPayouts.tsx` |
| 3 | Ensure lives table is in realtime publication | Database migration (if needed) |

### Technical Details

**Task 1 - Call Banner Fix**:
- Add `video_room_name: null, video_room_url: null` update to `endCall` in `useWebRTCCall.ts`
- The existing realtime listener in `ChatMessagesPanel` will automatically hide the banner when `video_room_name` becomes null

**Task 2 - Subscription Revenue**:
- Review `AdminAnalytics.tsx` and `AdminPayouts.tsx` to ensure they query `wallet_transactions` where `metadata->source = 'subscription'` in revenue breakdowns
- Add subscription category if missing from the breakdown charts/tables

**Task 3 - Real-Time Lives**:
- Verify `lives` table is in `supabase_realtime` publication via migration
- The existing `LivesContext` realtime handler already processes INSERT events and hydrates doctor profiles -- this should work once the publication is confirmed

