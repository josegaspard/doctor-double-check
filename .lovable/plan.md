

# Plan: Fix DailyVideoPlayer Duplicate Instance Error

## Problem
The console shows `"Duplicate DailyIframe instances are not allowed"` when a patient tries to watch a live stream. This happens because React 18 StrictMode (used in development) runs effects twice: mount -> unmount -> mount. The first `Daily.createCallObject()` hasn't fully destroyed by the time the second one tries to create, causing the error and preventing the video from loading.

## Root Cause
In `src/components/live/DailyVideoPlayer.tsx` (line 56), `Daily.createCallObject()` is called inside a `useEffect`. When React re-runs the effect, the cleanup (line 80-86) calls `leave()` and `destroy()` asynchronously, but the new effect fires before destruction completes, triggering the duplicate instance error.

## Fix

**File: `src/components/live/DailyVideoPlayer.tsx`**

1. Before creating a new call object, check for and destroy any existing instance using `Daily.getCallInstance()`:
   - If an existing instance exists, destroy it first and wait for it to complete
   - Add a guard ref (`isInitializing`) to prevent concurrent initialization attempts

2. Wrap `Daily.createCallObject()` in a try-catch that specifically handles the "Duplicate" error by:
   - Getting the existing instance via `Daily.getCallInstance()`
   - Destroying it
   - Retrying the creation after a short delay

3. Add a mounted/cancelled flag to the effect to prevent state updates after unmount.

### Specific Code Changes:

```typescript
useEffect(() => {
  if (!roomUrl || !token) return;
  let cancelled = false;

  const initCall = async () => {
    try {
      // Destroy any lingering instance first
      try {
        const existing = Daily.getCallInstance();
        if (existing) {
          await existing.destroy();
        }
      } catch { /* no existing instance */ }

      if (cancelled) return;

      const call = Daily.createCallObject({
        videoSource: isOwner,
        audioSource: isOwner,
      });
      
      if (cancelled) {
        call.destroy();
        return;
      }
      
      callRef.current = call;
      // ... rest of setup
    } catch (err) {
      if (cancelled) return;
      console.error('Error joining Daily room:', err);
      setError(err.message || 'Error connecting');
      setIsJoining(false);
    }
  };

  initCall();

  return () => {
    cancelled = true;
    if (callRef.current) {
      callRef.current.leave().catch(() => {});
      callRef.current.destroy().catch(() => {});
      callRef.current = null;
    }
  };
}, [roomUrl, token, isOwner]);
```

## Files to Edit

| File | Change |
|------|--------|
| `src/components/live/DailyVideoPlayer.tsx` | Add `Daily.getCallInstance()` cleanup before creating new instance; add cancellation guard for StrictMode |

This is a single-file fix that will resolve the video player not loading for patients (and all users).
