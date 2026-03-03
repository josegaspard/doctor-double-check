

# Fix: Video Calls Not Connecting Between Participants

## Root Cause

The edge function logs reveal the problem: **multiple Daily rooms are being created for the same consultation** in rapid succession (6 rooms created for consultation `2a8aee14` within seconds). This happens because:

1. `initDailyCall` has no ref-based guard against concurrent execution -- the `callState !== 'idle'` check in `handleStart` uses React state which may not update fast enough between rapid clicks
2. Each invocation creates a NEW `DailyIframe.createCallObject()` without destroying the previous one
3. Each room creation overwrites `video_room_name`/`video_room_url` in the consultation row
4. The doctor ends up in the **last** room created, while the patient may have already polled and joined an **earlier** room -- they're in different Daily rooms and can't see each other

## Fix

**File: `src/hooks/useWebRTCCall.ts`**

1. Add a `isInitializingRef` (boolean ref) to prevent concurrent `initDailyCall` calls -- check it at the top, set it `true` immediately, reset on completion/error
2. Before creating a new call object, destroy any existing one (`callObjectRef.current`) to prevent orphaned Daily instances
3. These two changes ensure only ONE room is created per call attempt, and doctor + patient always end up in the same room

## Files to modify
- `src/hooks/useWebRTCCall.ts` -- Add initialization guard ref + cleanup previous call object before creating new one

