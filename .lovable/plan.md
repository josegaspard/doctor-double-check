

# Plan: Fix Live Video Not Playing on iPad/Mobile

## Problem
On iPad and mobile devices (especially iOS Safari), the live video doesn't play for viewers. This is because mobile browsers **block unmuted autoplay** -- they require either user interaction or muted video to autoplay.

In `DailyVideoPlayer.tsx`, the `updateVideoElements` function creates video elements with `autoplay = true` but sets `muted = false` for remote participants (the doctor's stream). iOS Safari silently refuses to play these, resulting in a black screen with no error.

## Solution

Apply a **muted autoplay with unmute fallback** pattern:

1. Initially create all video elements as **muted** so autoplay works on all platforms
2. After the video starts playing, attempt to **unmute programmatically**
3. If unmuting fails (browser policy), show a visible **"Tap to unmute"** button
4. Add `webkit-playsinline` attribute for older iOS compatibility
5. Add explicit `.play()` call with error handling as a safety net

## Technical Changes

### File: `src/components/live/DailyVideoPlayer.tsx`

**1. Add state for mute prompt** (around line 48):
- Add `const [showUnmutePrompt, setShowUnmutePrompt] = useState(false);`

**2. Update `updateVideoElements` (lines 212-231)**:
- Set `videoEl.muted = true` for ALL participants initially (not just local)
- Add `videoEl.setAttribute('webkit-playsinline', 'true')` for older iOS
- After `videoEl.srcObject = stream`, call `videoEl.play()` with a `.then()` that attempts to unmute remote participant videos:
  ```typescript
  videoEl.play().then(() => {
    if (!participant.local) {
      videoEl.muted = false; // try unmuting
    }
  }).catch(() => {
    // Autoplay completely blocked, show tap-to-play
    if (!participant.local) {
      setShowUnmutePrompt(true);
    }
  });
  ```

**3. Also handle audio-only fallback (lines 232-238)**:
- Same muted-first pattern for audio elements
- `audioEl.muted = true` initially, then attempt unmute after `.play()`

**4. Add "Tap to unmute" UI overlay** (in the JSX, around line 345):
- Render a button overlay when `showUnmutePrompt` is true
- On tap, find all video/audio elements in the container and set `muted = false`, then call `.play()`
- This satisfies the browser's "user gesture" requirement

**5. Add unmute handler function**:
```typescript
const handleUnmute = useCallback(() => {
  if (!videoContainerRef.current) return;
  videoContainerRef.current.querySelectorAll('video, audio').forEach((el) => {
    (el as HTMLMediaElement).muted = false;
    (el as HTMLMediaElement).play().catch(() => {});
  });
  setShowUnmutePrompt(false);
}, []);
```

## Files

| File | Change |
|------|--------|
| `src/components/live/DailyVideoPlayer.tsx` | Muted autoplay + unmute fallback + tap-to-unmute UI |

