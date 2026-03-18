

# Plan: Fix Live Stream Issues + Pinned Highlighted Chat + Post-Live Summary

## 1. Sticky "Return to Live" Banner (Global)

**Problem:** Doctor navigates away from `/doctor/go-live` during an active stream and loses their session (black screen on return).

**Solution:** Create a global context `ActiveLiveContext` that persists the live state (liveId, roomUrl, ownerToken, title, etc.) across navigation. Add a sticky floating banner in `MainLayout` that appears on ALL pages when a live is active.

**Files:**
- **New: `src/contexts/ActiveLiveContext.tsx`** — Global context storing active live session data (liveId, dailyRoomUrl, dailyOwnerToken, title, enableRecording, tags, recordingPrice, liveStartedAt). Wraps the app in `App.tsx`.
- **Edit: `src/pages/DoctorGoLive.tsx`** — On `handleStartLive`, store session in `ActiveLiveContext`. On page mount, check if context has an active live and restore state from it (re-join Daily room). On `handleEndLive`, clear context.
- **New: `src/components/live/ActiveLiveBanner.tsx`** — Sticky floating banner: red pulsing dot + "EN VIVO: {title}" + "Volver" button. Only renders when context has active live AND current route is NOT `/doctor/go-live`. Fixed position `bottom-20` (above mobile nav).
- **Edit: `src/components/layout/MainLayout.tsx`** — Import and render `<ActiveLiveBanner />` inside the layout.
- **Edit: `src/App.tsx`** — Wrap with `<ActiveLiveProvider>`.

## 2. Fix Black Screen on Return + Blank Screen After Ending

**Problem 1:** Returning to the live page after navigating away shows a black screen because the Daily call instance was destroyed on unmount (line 87-97 cleanup).

**Fix:** Remove the aggressive `destroy()` on unmount. Instead, only destroy when explicitly ending. The `ActiveLiveContext` keeps the room info so `DailyVideoPlayer` can re-join.

**Problem 2:** After ending the live and closing the ending modal, blank screen because `isLive` is set to `false` and `navigate()` fires but the component renders nothing in between.

**Fix:** In `handleEndLive`, navigate BEFORE setting `showEndingModal = false` in the `finally` block. Ensure the `'done'` stage waits, then navigates, then cleans up state. Move `setIsLive(false)` and `setLiveData(null)` to happen before navigation, and ensure `showEndingModal` closes after navigation completes.

**File:** `src/pages/DoctorGoLive.tsx`
- Remove the unmount cleanup effect (lines 87-97) that destroys Daily call
- Restructure `handleEndLive` flow: ending → saving → uploading → choose (if recording) → done → navigate → cleanup state
- Add `'choose'` stage: after upload, if `enableRecording && recordingCreated`, set stage to `'choose'` and wait for user decision via `onKeepDecision`. If they decline, delete recording from DB + storage.

## 3. Pinned Highlighted Messages in Live Chat

**Problem:** Paid highlighted messages appear inline with regular messages and scroll away.

**Solution:** Separate pinned highlighted section at the TOP of the chat, above the scrollable message list. Active highlighted messages (where `highlightUntil > now()`) are shown in a distinct pinned area with a special background color. When multiple are pinned, they stack. Clicking a pinned message expands it. They remain pinned for the agreed duration.

**File:** `src/components/live/LiveChat.tsx`
- Add state: `pinnedMessages` computed from `messages` where `isPaid && highlightUntil > now()`
- Add a timer (`setInterval` every 5s) to re-evaluate which messages are still highlighted
- Render a pinned section between the header and ScrollArea:
  - Distinct amber/gold background (`bg-amber-50 border-amber-200`)
  - Each pinned message shows: user name, content preview (truncated), time remaining
  - Clicking expands to full content in a small dialog/popover
  - When highlight expires, message moves to normal flow
- Regular messages list stays as-is but excludes currently-pinned messages from the main flow (they appear in BOTH places: pinned area + inline with special styling)

## 4. Post-Live Summary Stats (EndingLiveModal `'done'` stage)

**Problem:** After ending a live, the doctor only sees "¡Listo!" with no stats.

**Solution:** Enhance the `'done'` stage of `EndingLiveModal` to show a summary card with stats fetched from the DB.

**Files:**
- **Edit: `src/components/live/EndingLiveModal.tsx`**
  - Add new prop `liveId?: string`
  - In the `'done'` stage, fetch stats from DB:
    - `lives` table: `peak_viewers`, `likes_count`, `questions_count`, `paid_chats_count`
    - `live_chat_messages` count where `live_id = liveId`
    - `live_chat_messages` count where `is_paid = true` for paid chat count
    - Calculate paid chat revenue: `paid_chats_count * chat_price`
    - If recording was saved: show link to recording
  - Display as a grid of stat cards (peak viewers, total likes, total comments, paid comments, revenue)

- **Edit: `src/components/live/LiveDialogs.tsx`** — Pass `liveId` to `EndingLiveModal`
- **Edit: `src/pages/DoctorGoLive.tsx`** — Pass `liveData?.id` through to `LiveDialogs`

## 5. Recording Purchase Revenue (Bonus in Summary)

The `'done'` stage summary will note: "Tu grabación está disponible — las compras se mostrarán en tu panel de ganancias." Since the recording was just created, there are no purchases yet, but the doctor dashboard already shows this info.

---

## Files to Create
1. `src/contexts/ActiveLiveContext.tsx`
2. `src/components/live/ActiveLiveBanner.tsx`

## Files to Modify
1. `src/App.tsx` — Wrap with ActiveLiveProvider
2. `src/pages/DoctorGoLive.tsx` — Integrate context, fix lifecycle, add choose stage
3. `src/components/live/LiveChat.tsx` — Pinned highlighted messages section
4. `src/components/live/EndingLiveModal.tsx` — Post-live summary stats
5. `src/components/live/LiveDialogs.tsx` — Pass liveId prop
6. `src/components/layout/MainLayout.tsx` — Render ActiveLiveBanner

