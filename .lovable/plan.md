

# Plan: Fix WebRTC Video Calls -- Full Bidirectional Video + Audio

## Problems Found

### 1. No TURN Server (Critical)
The ICE configuration only has STUN servers. STUN alone fails when both peers are behind symmetric NATs (very common on mobile networks and corporate WiFi). Without a TURN relay server, the WebRTC connection silently fails to establish in many real-world scenarios -- no video, no audio, no error message.

### 2. `ontrack` handler fragile
The current code uses `event.streams[0]?.getTracks()` to get remote tracks. Some browsers don't populate `event.streams`, so `event.track` (which is always present) must be used as fallback. Missing this means remote video/audio tracks are silently dropped.

### 3. Missing `useEffect` to sync remoteStream to video element
The callback ref updates when its identity changes, but there's a timing issue: `remoteStream` may update (e.g., audio track arrives after video) without the ref callback re-firing properly. An explicit `useEffect` watching `remoteStream` guarantees the video element always has the latest stream.

### 4. No TURN = no audio either
Since video and audio travel over the same RTCPeerConnection, if the connection fails due to NAT issues, both video AND audio are lost.

---

## Solution

### A. Add a free TURN server (useWebRTCCall.ts)

Add Metered.ca free TURN servers (or Google's open relay) to the ICE configuration alongside the existing STUN servers. This ensures connectivity even behind restrictive NATs.

```typescript
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  {
    urls: 'turn:a.relay.metered.ca:80',
    username: 'free',
    credential: 'free',
  },
  {
    urls: 'turn:a.relay.metered.ca:443',
    username: 'free',
    credential: 'free',
  },
  {
    urls: 'turn:a.relay.metered.ca:443?transport=tcp',
    username: 'free',
    credential: 'free',
  },
];
```

### B. Fix `ontrack` handler to use `event.track` directly (useWebRTCCall.ts)

Replace the fragile `event.streams[0]?.getTracks()` with the always-available `event.track`:

```typescript
pc.ontrack = (event) => {
  console.log('[WebRTC] ontrack:', event.track.kind, 'readyState:', event.track.readyState);
  // Use event.track directly (always available, unlike event.streams)
  const track = event.track;
  // Avoid duplicate tracks
  const existing = remoteTracksRef.current.getTracks();
  if (!existing.find(t => t.id === track.id)) {
    remoteTracksRef.current.addTrack(track);
  }
  setRemoteStream(new MediaStream(remoteTracksRef.current.getTracks()));
};
```

### C. Add `useEffect` to sync remoteStream to video element (VideoCall.tsx)

Add an explicit effect that updates the video element's `srcObject` whenever `remoteStream` changes:

```typescript
useEffect(() => {
  if (remoteVideoRef.current && remoteStream) {
    remoteVideoRef.current.srcObject = remoteStream;
    remoteVideoRef.current.play().catch(() => {});
  }
}, [remoteStream]);
```

And the same for localStream:

```typescript
useEffect(() => {
  if (localVideoRef.current && localStream) {
    localVideoRef.current.srcObject = localStream;
    localVideoRef.current.play().catch(() => {});
  }
}, [localStream]);
```

### D. Add `disconnected` state recovery (useWebRTCCall.ts)

Handle the `disconnected` ICE state (common on mobile when switching networks) by giving it time to recover before declaring failure:

```typescript
pc.oniceconnectionstatechange = () => {
  console.log('[WebRTC] ICE connection state:', pc.iceConnectionState);
  if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
    setCallState('connected');
  } else if (pc.iceConnectionState === 'failed') {
    setCallState('error');
  }
};
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/useWebRTCCall.ts` | Add TURN servers, fix `ontrack` handler, improve ICE state handling |
| `src/pages/VideoCall.tsx` | Add `useEffect` to sync streams to video elements |

