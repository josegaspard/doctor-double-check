

# Plan: Fix Screen Share, Chat Scroll, and Viewer Count Display

## Issue 1: Screen Sharing Not Visible

**Root cause:** The `updateVideoElements` function uses closure-captured `isScreenSharing` and `hasRemoteScreenShare` values that are stale because `useCallback` dependencies don't include them. Also, the screen share container ref (`screenShareRef`) is only rendered conditionally when `showingScreenShare` is true, but the screen share track arrives BEFORE the state updates, so the ref is null when the track needs to be attached.

**Fix in `DailyVideoPlayer.tsx`:**
- Always render the `screenShareRef` div (hidden when no screen share) so it's available when tracks arrive
- Convert `updateVideoElements` to read screen share state from the participants directly instead of relying on stale closure state
- Handle the `participant-updated` event specifically for screen share track detection with proper re-render
- Add proper cleanup when screen sharing stops

## Issue 2: Chat Enter Key Causes Page Scroll

**Root cause:** In `LiveChat.tsx` line 205, the `onKeyDown` handler calls `handleSend()` but doesn't call `e.preventDefault()` or `e.stopPropagation()`. The Enter key event bubbles up and triggers default browser behavior, which in some layouts causes scrolling.

**Fix in `LiveChat.tsx`:**
- Add `e.preventDefault()` and `e.stopPropagation()` in the `onKeyDown` handler when `Enter` is pressed

## Issue 3: Viewer Count Shows 0 in Recording Cards

**Root cause:** Two problems:
1. When the recording is created (via `useLocalRecording.uploadRecording`), `peak_viewers` is not being set -- it's not passed in the upload metadata
2. In `LivesContext.tsx` line 256, `(r as any).peak_viewers` works but the value is never populated in the recording row

**Fix:**
- In `DoctorGoLive.tsx`: After creating the recording, update it with `peak_viewers` from the live's `viewer_count` / `peak_viewers`
- In `LivesContext.tsx`: Remove the `(r as any)` cast since `peak_viewers` is now in the schema types
- In `RecordingsGrid.tsx`: Display peak viewers more prominently -- show it below the doctor name with an Eye icon and a proper label like "X espectadores", not just a tiny corner badge

---

## Technical File Changes

| File | Change |
|------|--------|
| `src/components/live/DailyVideoPlayer.tsx` | Always render screen share container; fix stale closure in `updateVideoElements`; detect screen share from participant tracks directly |
| `src/components/live/LiveChat.tsx` | Add `e.preventDefault()` + `e.stopPropagation()` on Enter keydown |
| `src/pages/DoctorGoLive.tsx` | After recording upload, update the recording row with `peak_viewers` from the live |
| `src/contexts/LivesContext.tsx` | Remove `(r as any)` cast for `peak_viewers` |
| `src/pages/RecordingsGrid.tsx` | Show viewer count prominently in card body instead of tiny corner badge |

