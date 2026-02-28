

# Plan: Fix LivePlayer Redirecting Back to /lives

## Problem
When clicking a live card, the user lands on `/live/:id` but is immediately redirected back to `/lives`. This happens because:

1. React 18 StrictMode mounts the component, then unmounts it, then remounts it
2. During the unmount cleanup, `callRef.current.leave()` is called
3. This triggers the `left-meeting` Daily event
4. `handleLeftMeeting` calls `onLeave?.()` which is `() => navigate('/lives')`
5. The user gets sent back to `/lives` before the second mount can establish the connection

## Fix

**File: `src/components/live/DailyVideoPlayer.tsx`**

Add a `cleaningUpRef` that is set to `true` during cleanup. The `handleLeftMeeting` callback checks this ref and skips calling `onLeave` if cleanup is in progress.

### Changes:
1. Add `const cleaningUpRef = useRef(false);` alongside other refs (around line 37)
2. In `handleLeftMeeting` (line 113-117): check `if (cleaningUpRef.current) return;` before calling `onLeave`
3. In the cleanup function (line 97-104): set `cleaningUpRef.current = true` before calling `leave()`
4. In `initCall` (after creating the call object): reset `cleaningUpRef.current = false`

This is a single-file, 4-line fix that prevents the spurious navigation during React's StrictMode remount cycle while preserving intentional leave behavior (e.g., clicking the hang-up button via `leaveCall()`).

## Files

| File | Change |
|------|--------|
| `src/components/live/DailyVideoPlayer.tsx` | Add `cleaningUpRef` guard to prevent `onLeave` firing during cleanup |

