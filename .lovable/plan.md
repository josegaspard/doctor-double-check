
# Plan: Replace Video Call System + Migrate Lives to Daily

## Problem Summary

1. **Video calls broken**: The edge function logs confirm the last consultation was created with `mode: "live"` (broadcast-only), not `"consultation"`. The Daily.co iframe-based approach uses a conference model that only shows the doctor's video.
2. **Cloudflare Stream is unused**: Zero activity in `create-cloudflare-stream`, `end-cloudflare-stream`, `cloudflare-whip`, and `cloudflare-webhook` edge functions. The live streaming system using Cloudflare WHIP never connected to your account properly (no billing because no data ever flowed).
3. **Recordings lost**: Since Cloudflare never received video data, no VOD recordings were generated.

## Solution Architecture

### 1:1 Video Calls -- Native WebRTC (No third-party service)

Replace Daily.co entirely for consultations with browser-native WebRTC using Supabase Realtime for signaling. This gives true peer-to-peer video between doctor and patient with zero cost.

**How it works:**
- Doctor clicks "Start Call" -- browser captures camera/mic, creates WebRTC offer
- SDP offer and ICE candidates are exchanged via a Supabase Realtime broadcast channel (the same mechanism already used for `incoming_call` events)
- Patient accepts -- browser captures camera/mic, creates WebRTC answer
- Direct peer-to-peer connection established -- both videos visible simultaneously
- No server processes video data, so there's no billing

### Live Streams -- Daily.co in broadcast mode + local recording backup

Migrate lives from Cloudflare Stream (which never worked) to Daily.co rooms. Daily is already configured and proven working (the rooms and tokens are created successfully).

**How it works:**
- Doctor starts live -- creates a Daily.co room with `owner_only_broadcast: true` (existing flow, already working)
- Viewers join with viewer tokens via `DailyVideoPlayer` component (already exists)
- Local recording runs in parallel via `useLocalRecording` (already implemented)
- When live ends, local recording is uploaded to `recordings` Storage bucket and saved to DB

---

## Technical Changes

### Phase 1: Native WebRTC for 1:1 Calls

**New file: `src/hooks/useWebRTCCall.ts`**
- Custom hook managing the full WebRTC peer-to-peer lifecycle
- Uses `navigator.mediaDevices.getUserMedia()` for camera/mic
- Creates `RTCPeerConnection` with public STUN servers (Google, Cloudflare)
- Signaling via Supabase Realtime broadcast channel (`call-signal-{consultationId}`)
- Handles offer/answer/ICE candidate exchange
- Exposes: `localStream`, `remoteStream`, `callState`, `startCall()`, `joinCall()`, `endCall()`, `toggleMute()`, `toggleCamera()`, `toggleScreenShare()`

**Modified: `src/pages/VideoCall.tsx`**
- Remove `DailyIframe` import and all Daily-related logic
- Replace with `useWebRTCCall` hook
- Render two `<video>` elements: large for remote stream, small PiP for local stream
- Doctor flow: `startCall()` creates offer, sends signaling, waits for patient
- Patient flow: `joinCall()` receives offer, sends answer
- Keep existing mobile fullscreen layout, timer, chat, and controls

**Removed dependencies:**
- Remove `useDaily` hook usage from VideoCall
- Remove `create-daily-room` invocation for consultations
- Remove `get-daily-token` invocation for consultations
- Remove `end-daily-room` invocation for consultations

**Signaling flow (no new edge functions needed):**
```text
Doctor                          Supabase Realtime                      Patient
  |                                   |                                   |
  |-- create offer ------------------>|                                   |
  |   (broadcast: "offer" + SDP)      |--- forward to channel ---------->|
  |                                   |                                   |
  |                                   |<-- "answer" + SDP ---------------|
  |<-- receive answer ----------------|                                   |
  |                                   |                                   |
  |<------------ ICE candidates exchanged via same channel ------------->|
  |                                   |                                   |
  |<================== Direct P2P video/audio connection ===============>|
```

### Phase 2: Lives via Daily.co + Local Recording

**Modified: `src/pages/DoctorGoLive.tsx`**
- Replace `useCloudflareStream()` with `useDaily()` for room creation
- Create Daily room with `mode: 'live'` (broadcast mode, already working)
- Use existing `useLocalRecording` for recording (already captures the local MediaStream)
- On end: stop local recording, upload to Storage, create DB entry + auto-create premium content
- Remove all Cloudflare WHIP/WebRTC broadcast logic
- Show local camera preview using `<video srcObject={localStream}>` instead of Cloudflare player

**Modified: `src/pages/LivePlayer.tsx`**
- Replace Cloudflare HLS player with Daily.co viewer
- Use `DailyVideoPlayer` component (already exists and works)
- Get viewer token via `get-daily-token` (already working)
- Remove all Cloudflare playback URL resolution logic and retry mechanism

**Modified: `src/contexts/LivesContext.tsx`**
- `endLive()`: call `end-daily-room` instead of `end-cloudflare-stream`
- Remove Cloudflare thumbnail generation logic (use uploaded thumbnails or a default)

**Modified: `src/hooks/cloudflare/index.ts`**
- Keep only `useLocalRecording` export
- Remove Cloudflare API and WebRTC exports (or keep as dead code for future use)

### Phase 3: Cleanup

**Edge functions to remove/deprecate:**
- `create-cloudflare-stream` -- no longer needed
- `end-cloudflare-stream` -- no longer needed
- `cloudflare-whip` -- no longer needed
- `cloudflare-webhook` -- no longer needed
- `get-cloudflare-playback` -- no longer needed for lives (keep for existing recording playback)

**Edge functions to keep:**
- `create-daily-room` -- used for lives
- `get-daily-token` -- used for live viewers
- `end-daily-room` -- used to clean up live rooms

---

## File Change Summary

| File | Action |
|------|--------|
| `src/hooks/useWebRTCCall.ts` | **NEW** -- Native WebRTC peer-to-peer call hook |
| `src/pages/VideoCall.tsx` | **REWRITE** -- Use native WebRTC, dual video layout |
| `src/pages/DoctorGoLive.tsx` | **MODIFY** -- Use Daily rooms instead of Cloudflare |
| `src/pages/LivePlayer.tsx` | **MODIFY** -- Use DailyVideoPlayer instead of Cloudflare HLS |
| `src/contexts/LivesContext.tsx` | **MODIFY** -- endLive uses end-daily-room |
| `src/hooks/cloudflare/index.ts` | **MODIFY** -- Simplify to just local recording |
| `src/components/videocall/VideoCallControls.tsx` | **KEEP** -- No changes needed |
| `src/components/videocall/IncomingCallModal.tsx` | **KEEP** -- No changes needed |

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| WebRTC P2P may fail behind strict NATs/firewalls | Use multiple STUN servers; show clear error message suggesting retry on different network |
| Daily free tier limits (10 participants for lives) | Already handled with retry logic in `create-daily-room` |
| Existing Cloudflare recordings in DB | `RecordingVideoPlayer` already handles `storage:` and Cloudflare UIDs -- no migration needed |
| Local recording quality | Already configured at 2.5 Mbps in `useLocalRecording` -- good for educational content |
