

# Plan: Fix Video Call Black Screen

## Root Causes Identified

### 1. srcObject timing issue (MAIN BUG)
The `useEffect` hooks that set `srcObject` on the video elements (lines 95-105 in VideoCall.tsx) have a race condition. When `callState` changes from `idle` to `connecting`, the video elements mount for the first time. But the `[localStream]` effect may have already run BEFORE the video elements existed in the DOM (because `localStream` was set during `getMedia()` while the component was still rendering the `idle` state). When the video elements finally mount, no effect re-runs because `localStream` hasn't changed -- it's the same reference.

**Fix**: Replace the two `useEffect` hooks with callback refs. A callback ref fires the moment the DOM element is created, guaranteeing `srcObject` is set immediately when the video element mounts, and also updates when the stream changes.

### 2. Patient autojoin calls getUserMedia from useEffect
When `autojoin=1`, the `useEffect` at line 114 calls `handleStart()` which calls `joinCall()` -> `getMedia()` -> `getUserMedia()`. Browsers require `getUserMedia` to be called from a direct user gesture. Calling it from `useEffect` may silently fail or return black tracks.

**Fix**: Remove the autojoin useEffect. Instead, when `autojoin=1` and `callState === 'idle'`, render a simple "Tap to join" screen with a button that calls `handleStart` directly from an `onClick`.

### 3. Controls only show during 'connected' state
The `VideoCallControls` only render when `callState === 'connected'` (line 256, 331). During the `connecting` phase, the user sees the video area with no controls. This makes it look broken. Should show a timer/end-call option during connecting too.

## Technical Changes

### File: `src/pages/VideoCall.tsx`

1. **Replace useEffect-based srcObject with callback refs**:
   - Remove the two `useEffect` blocks for localStream/remoteStream srcObject (lines 95-105)
   - Create two callback ref functions that set `srcObject` and call `.play()` whenever the element mounts or stream changes:
   ```typescript
   const localVideoRefCallback = useCallback((el: HTMLVideoElement | null) => {
     localVideoRef.current = el;
     if (el && localStream) {
       el.srcObject = localStream;
       el.play().catch(() => {});
     }
   }, [localStream]);
   
   const remoteVideoRefCallback = useCallback((el: HTMLVideoElement | null) => {
     remoteVideoRef.current = el;
     if (el && remoteStream) {
       el.srcObject = remoteStream;
       el.play().catch(() => {});
     }
   }, [remoteStream]);
   ```
   - Use these callback refs on the `<video>` elements instead of the plain refs

2. **Fix autojoin**: Remove the autojoin `useEffect`. When `autojoin=1` and `callState === 'idle'`, render a simple button screen:
   ```
   "Toca para unirte a la videollamada"
   [Unirse Button -> onClick={handleStart}]
   ```

3. **Show controls during connecting**: Change the condition from `callState === 'connected'` to `isInCall` for rendering VideoCallControls, so users can end the call even while connecting.

### File: `src/hooks/useWebRTCCall.ts`

4. **Ensure remoteStream updates trigger re-renders properly**: The `ontrack` handler currently mutates a local `remote` MediaStream variable and then creates a new one. This is fragile. Instead, use a ref for the remote MediaStream and always create a fresh state update:
   ```typescript
   const remoteRef = useRef<MediaStream>(new MediaStream());
   
   pc.ontrack = (event) => {
     event.streams[0]?.getTracks().forEach(track => {
       remoteRef.current.addTrack(track);
     });
     // Create new MediaStream to trigger React re-render
     setRemoteStream(new MediaStream(remoteRef.current.getTracks()));
   };
   ```

5. **Add logging** for debugging: Add `console.log` statements at key points (getUserMedia success, ICE state changes, track events) so future issues can be diagnosed.

## Summary of Files Changed

| File | Change |
|------|--------|
| `src/pages/VideoCall.tsx` | Replace useEffect srcObject with callback refs; fix autojoin to use button click; show controls during connecting |
| `src/hooks/useWebRTCCall.ts` | Use ref for remote MediaStream accumulation; add diagnostic logging |

