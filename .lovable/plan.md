

# Plan: Complete Rewrite of WebRTC Video Call System

## Root Cause (found after deep analysis)

The call NEVER connects because of a **lost ICE candidates** bug:

1. Doctor calls `startCall()` which creates the offer AND immediately starts ICE gathering
2. ICE candidates fire via `onicecandidate` and are broadcast to the signaling channel
3. **The patient has NOT subscribed to the channel yet** -- all ICE candidates are lost forever
4. When the patient finally joins and sends "ready", the doctor re-sends the offer SDP but **does NOT re-trigger ICE gathering** -- it just re-sends the stored SDP text
5. Without ICE candidates, the WebRTC connection can never establish
6. After 15 seconds, the timeout fires and shows "Error de conexion"

This explains why it ALWAYS fails -- it's not a TURN server issue or an autoplay issue. The fundamental signaling handshake is broken.

## Solution: Rewrite with correct signaling order

The fix is simple: **don't create the offer until the other party is confirmed listening**.

```text
  DOCTOR                          PATIENT
    |                                |
    |-- subscribe to channel ------->|
    |                                |-- subscribe to channel
    |<-- "ready" signal -------------|
    |                                |
    |-- createOffer() -------------->|  (NOW patient is listening)
    |-- ICE candidates flow -------->|  (patient receives them!)
    |                                |
    |<-- answer + ICE candidates ----|
    |                                |
    |===== CONNECTED ================|
```

### File 1: `src/hooks/useWebRTCCall.ts` (complete rewrite)

**Changes:**
- **`startCall()`**: Subscribe to channel, then send "caller-ready" signal. Do NOT create offer yet. Wait for patient's "ready" signal.
- **`handleSignal("ready")`**: When the caller receives "ready", NOW create the offer. ICE candidates will flow to the patient who is already listening.
- **Ready signal retry**: Send "ready" signal 3 times (at 0s, 2s, 4s) to handle timing where one side subscribes before the other.
- **Use a `handleSignalRef`**: So the channel listener always calls the latest version of the handler (avoids stale closure bug).
- **Increase timeout**: 30 seconds instead of 15 (mobile networks are slower).
- **Guard `hasCreatedOffer` ref**: Prevent duplicate offer creation if multiple "ready" signals arrive.

### File 2: `src/pages/VideoCall.tsx`

**Changes:**
- Keep the existing audio element approach (it's correct)
- Add a "Retry" mechanism on the error screen that fully cleans up and restarts
- Show better status messages during connection ("Connecting...", "Waiting for other party...")

## Technical Details

### New signaling flow in `startCall`:
```typescript
const startCall = async () => {
  const stream = await getMedia();
  createPeerConnection(stream);  // NO onnegotiationneeded
  await setupSignaling();
  
  // Send "ready" -- do NOT create offer yet
  sendSignal({ type: 'ready', senderId: userId });
  
  // Retry ready signal to handle timing
  retryReadySignal();
  startConnectionTimeout();
};
```

### New signaling flow in `handleSignal`:
```typescript
if (signal.type === 'ready' && isCallerRef.current && !hasCreatedOfferRef.current) {
  hasCreatedOfferRef.current = true;
  // NOW create offer -- patient is guaranteed to be listening
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  sendSignal({ type: 'offer', sdp: offer.sdp, senderId: userId });
}

if (signal.type === 'ready' && !isCallerRef.current) {
  // Patient received doctor's ready -- re-send own ready in case doctor missed it
  sendSignal({ type: 'ready', senderId: userId });
}
```

### handleSignalRef pattern (fixes stale closure):
```typescript
const handleSignalRef = useRef<(signal: SignalPayload) => void>(() => {});

// Update ref whenever handleSignal changes
useEffect(() => {
  handleSignalRef.current = handleSignal;
}, [handleSignal]);

// In setupSignaling, use the ref:
.on('broadcast', { event: 'signal' }, ({ payload }) => {
  handleSignalRef.current(payload as SignalPayload);
})
```

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/useWebRTCCall.ts` | Complete rewrite: fix signaling order, add ready-retry, use handleSignalRef, increase timeout to 30s, guard duplicate offers |
| `src/pages/VideoCall.tsx` | Better error/retry handling, keep audio element approach |

