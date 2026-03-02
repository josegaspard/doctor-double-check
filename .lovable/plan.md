

# Plan: Fix Live Stream Ending Error + Black Screen for Viewers

## Problem 1: "Error de conexion" when doctor ends live from mobile

**Root cause**: When the doctor ends the live, `handleEndLive` calls `endRoom(dailyRoomName)` which deletes the Daily room server-side. This triggers an error event in the `DailyVideoPlayer` component that the doctor is still connected to. The `handleError` callback catches some patterns ("meeting has ended", "exp") but misses others that Daily fires on mobile (connection reset, WebSocket closed, etc.), resulting in a generic "Error de conexion" toast.

Additionally, the `endRoom` call itself can fail on flaky mobile networks, causing the entire `handleEndLive` to throw and show an error.

**Fix in `src/pages/DoctorGoLive.tsx`**:
- Wrap the `endRoom` call in its own try-catch so it doesn't break the entire ending flow
- If `endRoom` fails, log a warning but continue (the room will auto-expire anyway)

**Fix in `src/components/live/DailyVideoPlayer.tsx`**:
- Add an `isLeavingRef` flag that is set to `true` before `leaveCall()` is called
- In `handleError`, suppress ALL errors when `isLeavingRef.current` or `cleaningUpRef.current` is true
- Add additional error patterns to the non-critical list: "connection error", "disconnected", "transport closed", "websocket"
- Export the leaveCall in a way that the parent can signal "about to end" before errors arrive

## Problem 2: Black screen with "Transmision en vivo" text for PC viewers

**Root cause**: The viewer resolution flow in `LivePlayer.tsx` has two critical weaknesses:

1. If `getViewerToken()` returns null (edge function fails), the viewer sees `playbackError` but does NOT retry. The viewer is stuck.
2. If the `resolveViewer` effect runs but gets cancelled due to `live` object updates from realtime (e.g., viewer_count changes cause re-render), the flow silently aborts. The viewer falls through to the generic placeholder showing just "Transmision en vivo".
3. The `dailyRoomName` might not be in the `lives` context object because the realtime update hasn't arrived yet, and the direct DB fallback query also misses it due to timing.

**Fix in `src/pages/LivePlayer.tsx`**:
- Add retry logic when `getViewerToken` fails (retry up to 3 times with 3-second delays)
- Change the generic "Transmision en vivo" fallback to include a retry button and a connecting spinner, so the user is never stuck on a dead-end screen
- Add a `retryCount` ref to prevent infinite retries but allow reasonable attempts
- Re-trigger `resolveViewer` when `live.dailyRoomName` arrives via realtime update

**Fix in `src/hooks/useDaily.ts`**:
- In `getViewerToken`, don't show `toast.error` immediately (it confuses the user). Instead, return null silently and let the caller handle retries.

## Summary of changes

| File | Change |
|------|--------|
| `src/pages/DoctorGoLive.tsx` | Wrap `endRoom` in separate try-catch; don't let it break the flow |
| `src/components/live/DailyVideoPlayer.tsx` | Add `isLeavingRef`, suppress errors during cleanup/leaving, add more non-critical error patterns |
| `src/pages/LivePlayer.tsx` | Add retry logic for viewer token, change fallback to show retry button + spinner |
| `src/hooks/useDaily.ts` | Suppress toast in `getViewerToken` to avoid misleading errors during retries |

