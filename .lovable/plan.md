
# Plan: Fix News Article Navigation and 1:1 Video Call

## Issue 1: "Escribir Articulo" redirects doctors away

**Root cause:** In `AdminNews.tsx` line 56, `canPublish` is initialized to `role === 'admin'`, which is `false` for doctors. Line 188 immediately renders `<Navigate to="/" replace />` when `role !== 'admin' && !canPublish` -- this fires BEFORE the async `useEffect` on line 65 can fetch and set `canPublish` to `true`.

**Fix in `src/pages/AdminNews.tsx`:**
- Add a `permissionLoading` state that starts as `true` for doctors
- Set it to `false` after the `can_publish_news` query resolves
- Show a loading spinner while `permissionLoading` is true instead of immediately redirecting
- Only redirect after permission check has completed and confirmed the doctor lacks the permission

**Fix in `src/components/doctor/DoctorQuickActions.tsx`:**
- Change the "Escribir Articulo" action to navigate to `/doctor/news` instead of `/admin/news` (both resolve to the same component, but `/doctor/news` is semantically correct for the doctor context)
- Only show this action to doctors who have `can_publish_news` permission -- add a `canPublishNews` prop and conditionally filter the action

## Issue 2: 1:1 Video Call fails to connect

**Root cause:** Race condition in the WebRTC signaling flow. The doctor sends the SDP offer via Supabase Realtime broadcast BEFORE the patient has subscribed to the signaling channel. Since broadcast messages are not persisted, the patient never receives the offer and both sides wait forever in "connecting" state.

**Fix in `src/hooks/useWebRTCCall.ts`:**
- Add a `ready` signal type to `SignalPayload`
- In `joinCall` (patient side): after subscribing to the channel, send a `{ type: 'ready' }` broadcast to notify the doctor
- In `startCall` (doctor side): store the offer in a ref. When a `ready` signal is received from the other side, re-send the stored offer
- In `handleSignal`: handle the `ready` type by re-sending the stored offer
- This ensures that regardless of join order, the offer is always delivered after both parties are listening

Additionally:
- Add a `negotiationneeded` event listener on the peer connection for robustness
- Increase the initial delay from 500ms to give the channel more time to subscribe before first offer attempt

---

## Technical File Changes

| File | Change |
|------|--------|
| `src/pages/AdminNews.tsx` | Add `permissionLoading` state; show loader while checking; only redirect after check completes |
| `src/components/doctor/DoctorQuickActions.tsx` | Change navigation to `/doctor/news`; add `canPublishNews` prop to conditionally show the action |
| `src/pages/DoctorDashboard.tsx` | Pass `canPublishNews` prop to `DoctorQuickActions` (fetch from doctor_profiles) |
| `src/hooks/useWebRTCCall.ts` | Add `ready` signal type; patient sends ready after subscribing; doctor re-sends offer on ready signal |
