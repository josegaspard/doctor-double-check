

# Plan: Fix Video Calls -- Bidirectional Video + Audio

## Root Causes Found

### Bug 1: Race Condition in Offer Creation (CRITICAL)
In `startCall()`, `createPeerConnection()` calls `addTrack()` which triggers `onnegotiationneeded` asynchronously. This handler creates an offer and calls `setLocalDescription()`. Meanwhile, `startCall()` ALSO creates an offer and calls `setLocalDescription()`. These two async operations race each other, causing `InvalidStateError` (can't set local description while another is pending). Result: the connection silently fails.

### Bug 2: Remote Audio Never Plays
The remote `<video>` element starts `muted` for autoplay policy, then the code tries to programmatically unmute. But iOS Safari silently pauses the video when unmuted. The user sees a black screen. Even when the "Tap to unmute" button works, it only unmutes the video element -- but by then the WebRTC connection may have already failed due to Bug 1.

### Bug 3: No Reliable TURN Server
The OpenRelay TURN servers (`openrelay.metered.ca`) with `openrelayproject/openrelayproject` credentials may be offline or rate-limited. Without TURN, calls fail when either peer is behind a symmetric NAT (common on mobile data).

---

## Solution

### A. Fix Race Condition (`src/hooks/useWebRTCCall.ts`)

Remove `onnegotiationneeded` from the initial peer connection setup. Only the explicit offer in `startCall()` should create the initial offer. Add `onnegotiationneeded` only AFTER the initial connection is established (for screen share renegotiation):

```typescript
// In createPeerConnection: do NOT set onnegotiationneeded
// In startCall: after creating offer manually, THEN set onnegotiationneeded for future renegotiations
```

Also add a `negotiating` guard ref to prevent glare:
```typescript
const isNegotiatingRef = useRef(false);
```

### B. Separate Audio Element for Remote Stream (`src/pages/VideoCall.tsx`)

Instead of relying on the muted/unmuted video element for audio, create a separate hidden `<audio>` element specifically for the remote audio tracks. This element can be unmuted immediately after the user's "Start" / "Join" tap (which counts as a user gesture):

```typescript
// Create a hidden <audio> element on user gesture (startCall/joinCall click)
const audioElRef = useRef<HTMLAudioElement | null>(null);

// On user gesture (handleStart), pre-create and "unlock" the audio element
const unlockAudio = useCallback(() => {
  const audio = new Audio();
  audio.volume = 1;
  audioElRef.current = audio;
}, []);

// When remoteStream arrives, set it as srcObject of the audio element
useEffect(() => {
  if (audioElRef.current && remoteStream) {
    audioElRef.current.srcObject = remoteStream;
    audioElRef.current.play().catch(() => {});
  }
}, [remoteStream]);
```

The video element stays permanently muted (so autoplay always works for the visual). Audio goes through the separate `<audio>` element which was "unlocked" by the user's tap.

### C. Add More TURN Servers + Validate Connectivity (`src/hooks/useWebRTCCall.ts`)

Add multiple free TURN providers as fallback. Also add connection timeout -- if ICE doesn't connect within 15 seconds, show an error instead of hanging forever:

```typescript
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];
```

Add a 15-second connection timeout:
```typescript
// In startCall/joinCall, after setting up signaling:
const connectionTimeout = setTimeout(() => {
  if (pcRef.current?.iceConnectionState !== 'connected' && 
      pcRef.current?.iceConnectionState !== 'completed') {
    console.error('[WebRTC] Connection timed out');
    setCallState('error');
  }
}, 15000);
```

### D. Send "end-call" Signal (`src/hooks/useWebRTCCall.ts`)

When one party ends the call, broadcast an `end-call` signal so the other party's UI also transitions to the "ended" state:

```typescript
// In endCall:
channelRef.current?.send({
  type: 'broadcast',
  event: 'signal',
  payload: { type: 'end-call', senderId: userId },
});

// In handleSignal, handle 'end-call':
if (signal.type === 'end-call') {
  endCall();
}
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/useWebRTCCall.ts` | Fix race condition (remove early onnegotiationneeded), add connection timeout, add end-call signal, update SignalPayload type |
| `src/pages/VideoCall.tsx` | Add separate hidden audio element for remote audio, unlock on user gesture, keep video permanently muted |

