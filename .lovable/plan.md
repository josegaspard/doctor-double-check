

# Plan: Fix mobile live stream not starting (stuck on "preparando")

## Root cause

There are **two Daily call objects** being created when going live:

1. **`DoctorGoLive.tsx` (line 156-158)**: Creates a call object and joins inside `handleStartLive`
2. **`DailyVideoPlayer.tsx` (line 65-120)**: When it mounts (after `isLive` becomes true), its `useEffect` destroys the existing call and creates a **new** one

On mobile, this second creation happens inside a `useEffect` — outside the user gesture context. Mobile browsers (especially Safari) block media access (`getUserMedia`) when not triggered directly by a user tap. This causes the new call to fail silently, leaving the stream stuck on "preparando/conectando".

## Fix — `src/pages/DoctorGoLive.tsx`

**Remove the duplicate Daily call creation** (lines 150-158). Let `DailyVideoPlayer` be the single owner of the Daily call lifecycle — it already creates, joins, and cleans up the call in its own `useEffect`.

Changes:
1. Remove lines 150-158 (the `Daily.createCallObject` + `call.join` block in `handleStartLive`)
2. Remove the `callObjectRef` ref and its cleanup in `useEffect` (line 52, lines 87-95)
3. In `handleEndLive`, replace `callObjectRef.current` usage with `Daily.getCallInstance()` to get and destroy the active call
4. Remove the `import Daily` since we'll use try/catch with `Daily.getCallInstance()` — actually keep the import for `getCallInstance`

This ensures only one Daily call object exists, created by `DailyVideoPlayer`, and the user gesture chain from `handleStartLive` (which calls `getUserMedia` at line 102) is not broken by a second competing creation.

