

# Plan: Fix "Duplicate DailyIframe instances" Error

## Problem

The `DailyVideoPlayer` component crashes with "Duplicate DailyIframe instances are not allowed" because:

1. React StrictMode unmounts and remounts the component rapidly
2. The cleanup calls `callRef.current.destroy()` but this is asynchronous
3. The second mount tries `Daily.createCallObject()` before the first instance finishes destroying
4. The `initializedRef` guard doesn't help because cleanup resets it to `false`

The edge function (`get-daily-token`) is working correctly -- logs confirm tokens are being generated. The error is purely on the client side.

## Solution

Modify `src/components/live/DailyVideoPlayer.tsx` to handle the singleton constraint of Daily.js:

1. Before calling `Daily.createCallObject()`, check if an existing instance exists by wrapping the creation in a try/catch
2. If "Duplicate DailyIframe" error is caught, wait briefly for the previous instance to finish destroying, then retry once
3. Add a module-level variable to track the active call object so cleanup can properly await destruction before re-initialization

### Implementation Details

**File: `src/components/live/DailyVideoPlayer.tsx`**

- Add a module-level `let activeCall: DailyCall | null = null` outside the component to track the global Daily singleton
- In `initCall()`:
  - If `activeCall` exists, destroy it first and await the destruction
  - Create the new call object only after the previous one is fully destroyed
  - Assign the new instance to both `callRef.current` and `activeCall`
- In cleanup:
  - Do NOT reset `initializedRef` (so StrictMode's remount is blocked)
  - Only destroy and clean up when the component truly unmounts (use a mounted flag)
- Remove the `initializedRef` pattern entirely since the module-level singleton tracking handles it better

```text
Before (broken):
  Mount 1 -> createCallObject() -> OK
  Cleanup 1 -> destroy() (async, not awaited) -> initializedRef = false
  Mount 2 -> initializedRef is false -> createCallObject() -> CRASH (previous not fully destroyed)

After (fixed):
  Mount 1 -> destroy activeCall if exists -> createCallObject() -> OK
  Cleanup 1 -> destroy activeCall, set activeCall = null (awaited)
  Mount 2 -> activeCall is null -> createCallObject() -> OK
```

| File | Change |
|------|--------|
| `src/components/live/DailyVideoPlayer.tsx` | Replace initializedRef with module-level singleton + async cleanup |

