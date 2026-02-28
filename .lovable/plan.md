

# Plan: Fix iPad Black Screen, Likes Count, Share Options, Private Chat, and Chat Scroll Issues

## 1. iPad Black Screen Fix (DailyVideoPlayer)

**Root Cause:** In `DailyVideoPlayer.tsx`, video elements are created programmatically with `document.createElement('video')` and `autoplay` is set as a property. On iPad/iOS Safari, the `autoplay` property alone is insufficient -- an explicit `.play()` call is required after setting `srcObject`, with a muted fallback for autoplay policy compliance.

**File: `src/components/live/DailyVideoPlayer.tsx`**
- In `updateVideoElements()`, after setting `videoEl.srcObject = stream`, add `videoEl.play().catch(() => { videoEl.muted = true; videoEl.play().catch(() => {}); })` for each video element
- Do the same for screen share video elements
- Add `videoEl.setAttribute('webkit-playsinline', 'true')` for older iPads

## 2. Likes Count Showing 0

**Root Cause:** Two problems:
1. `likeLive()` in LivesContext doesn't check the Supabase insert response for errors -- it only catches thrown exceptions. If the DB insert fails (e.g., RLS), the error is silently ignored but the optimistic update already happened, then gets rolled back by the realtime subscription
2. In LivePlayer, the display uses `realtimeLikesCount || live.likesCount` -- the `||` operator treats `0` as falsy, so if the DB starts at 0 and the realtime hook hasn't fetched yet, it stays at 0 even after optimistic increment

**File: `src/contexts/LivesContext.tsx`**
- In `likeLive()`: Destructure `{ error }` from the insert response and throw if error exists, so the catch block can rollback
- In `unlikeLive()`: Same -- check for `{ error }` from the delete response

**File: `src/pages/LivePlayer.tsx`**
- Change `realtimeLikesCount || live.likesCount` to `realtimeLikesCount > 0 ? realtimeLikesCount : live.likesCount` (3 occurrences) -- this ensures 0 from realtime doesn't override a valid context value

## 3. Share Button with Platform Options

**Root Cause:** Currently uses Web Share API with clipboard fallback. User wants WhatsApp, email, and copy link options visible.

**File: `src/pages/LivePlayer.tsx`**
- Replace the simple share button with a Popover containing share options:
  - Copy link (clipboard)
  - WhatsApp (`https://wa.me/?text=...`)
  - Email (`mailto:?subject=...&body=...`)
  - Native share (if `navigator.share` is available)
- Use existing Popover component from `@/components/ui/popover`

## 4. "Start Private Chat" Error Fix

**Root Cause:** The `.or()` filter syntax may fail, and the logic doesn't check whether the doctor offers free consultations. When no session exists, user should be redirected to the doctor's profile with a payment modal trigger.

**File: `src/pages/LivePlayer.tsx`**
- Rewrite `handleStartPrivateChat`:
  1. Query `chat_sessions` using two separate `.eq()` conditions instead of `.or()` with complex filter
  2. If active session found, navigate to `/chat?session=ID`
  3. If no session, fetch `doctor_profiles_public.consultation_fee` for the doctor
  4. If fee is 0 (free), navigate directly to `/chat` and create a new session
  5. If fee > 0, navigate to `/doctor/{doctorId}?orientation=true` to trigger the payment modal
  6. Show appropriate toast message

## 5. Chat Scroll-to-Footer Bug (Critical)

**Root Cause:** `messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })` scrolls the nearest scrollable ancestor. However, Radix ScrollArea uses `overflow: hidden` on the root and the actual scroll container is an inner `Viewport` element. Since the root has `overflow: hidden`, `scrollIntoView` traverses UP to the page-level scrollable element (the body/html), causing the entire page to scroll to the footer.

**File: `src/components/live/LiveChat.tsx`**
- Remove the `useEffect` that calls `messagesEndRef.current?.scrollIntoView()`
- Instead, get a ref to the ScrollArea's viewport element and manually set `viewport.scrollTop = viewport.scrollHeight`
- Use a ref on the ScrollArea component and query `.querySelector('[data-radix-scroll-area-viewport]')` to find the viewport
- Only auto-scroll when a new message is added (not on every re-render), and only if user is already near the bottom (within 100px) to avoid disrupting manual scrolling

## Technical Summary

| File | Changes |
|------|---------|
| `src/components/live/DailyVideoPlayer.tsx` | Add `.play()` with muted fallback on programmatic video elements for iPad |
| `src/contexts/LivesContext.tsx` | Check `{ error }` from Supabase insert/delete in likeLive/unlikeLive |
| `src/pages/LivePlayer.tsx` | Fix likes display with nullish check; add share popover with WhatsApp/email/copy; fix private chat logic with consultation fee check |
| `src/components/live/LiveChat.tsx` | Replace `scrollIntoView` with manual viewport scroll to prevent page scroll |

