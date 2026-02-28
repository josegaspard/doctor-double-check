

# Plan: Fix Video Calls (No Audio/Video) + Fix Live Black Screen on Mobile

## Issue 1: Video Calls -- Doctor and Patient Can't See/Hear Each Other

### Root Cause
The remote `<video>` element in `VideoCall.tsx` (line 225-230) does NOT have the `muted` attribute. On iOS Safari and mobile browsers, **unmuted autoplay is blocked silently** -- the browser simply refuses to play the video, resulting in a black screen with no audio. This affects BOTH directions because both participants are viewing on mobile.

The local video works because it has `muted` (line 247), so iOS allows it to autoplay.

### Fix: `src/pages/VideoCall.tsx`
1. Add `muted` attribute to the remote `<video>` element initially
2. Add a `showUnmutePrompt` state
3. In the `useEffect` that syncs `remoteStream`, after calling `.play()`, attempt to set `muted = false`. If playback pauses (detected via `pause` event), show a "Tap to enable audio" overlay
4. Add a "Tap to enable audio/video" button overlay that, on user gesture, unmutes the video and calls `.play()` -- this satisfies the browser's user interaction requirement
5. Add `webkit-playsinline` attribute for older iOS devices

### Fix: `src/hooks/useWebRTCCall.ts`
1. Replace the non-functional Metered.ca TURN credentials (`free`/`free` don't actually work -- Metered requires an API key) with the OpenRelay Project's public TURN servers that are genuinely free and functional:
   - `turn:openrelay.metered.ca:80` with `openrelayproject`/`openrelayproject`
   - `turn:openrelay.metered.ca:443`
   - `turn:openrelay.metered.ca:443?transport=tcp`
2. Add ICE restart logic: if `iceConnectionState` becomes `'failed'`, attempt an ICE restart automatically once before giving up

---

## Issue 2: Live Stream Black Screen on Mobile/iPad (Persists)

### Root Cause
In `DailyVideoPlayer.tsx` (lines 237-249), after calling `videoEl.play()`, the code sets `videoEl.muted = false`. However, on iOS Safari:
- Setting `muted = false` does NOT throw an error -- it silently causes the video to **pause**
- The `try/catch` block never catches anything because property assignment doesn't throw
- The video stops, resulting in a black screen

### Fix: `src/components/live/DailyVideoPlayer.tsx`
1. After setting `videoEl.muted = false`, check if the video actually paused. If it did, re-mute it and show the unmute prompt:
   ```typescript
   videoEl.play().then(() => {
     if (!participant.local) {
       videoEl.muted = false;
       // iOS Safari pauses the video when unmuted programmatically
       setTimeout(() => {
         if (videoEl.paused) {
           videoEl.muted = true;
           videoEl.play().catch(() => {});
           setShowUnmutePrompt(true);
         }
       }, 100);
     }
   }).catch(() => {
     if (!participant.local) setShowUnmutePrompt(true);
   });
   ```
2. Apply the same pattern to the audio-only fallback element

---

## Summary

| File | Change |
|------|--------|
| `src/pages/VideoCall.tsx` | Muted autoplay for remote video + "Tap to enable audio" overlay |
| `src/hooks/useWebRTCCall.ts` | Replace broken TURN credentials with working OpenRelay servers + ICE restart |
| `src/components/live/DailyVideoPlayer.tsx` | Fix unmute detection (check for paused state after unmuting) |

