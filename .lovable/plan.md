

# Fix: Duplicate Controls on Mobile Live Streaming

## Problem

When a doctor streams live from a mobile device, two overlapping UIs appear:

1. **DailyVideoPlayer internal controls** -- "EN VIVO" badge, participant count, mute, video, fullscreen, and leave buttons rendered inside the video component itself.
2. **LiveStreamView mobile overlay** -- A second "EN VIVO" badge, time/viewers/likes metrics, and another set of mute, video, chat, and "Finalizar" buttons.

This creates visual clutter, duplicate data, and a confusing experience.

## Solution

Pass a prop `hideControls` to `DailyVideoPlayer` so that when it's rendered inside the mobile `LiveStreamView`, all internal overlays (badges, controls) are hidden. The parent (`LiveStreamView`) becomes the single source of truth for mobile UI.

Additionally, connect the mobile mute/video buttons in `LiveStreamView` to the actual Daily call object so they actually work (currently they only toggle local state without affecting the call).

## Changes

### File 1: `src/components/live/DailyVideoPlayer.tsx`

- Add a new prop: `hideControls?: boolean` (default `false`).
- Wrap the "EN VIVO" badge (lines 407-413), participant count badge (lines 416-421), screen share indicator (lines 424-431), and bottom controls bar (lines 446-511) in a condition: only render when `hideControls` is **not** true.
- Export the `toggleMute`, `toggleVideo`, and `leaveCall` functions via a `useImperativeHandle` + `forwardRef` pattern so the parent can call them.
- Also expose `isMuted` and `isVideoOff` state so the parent can read the actual state.

### File 2: `src/components/live/LiveStreamView.tsx`

- Pass `hideControls={true}` to `DailyVideoPlayer` in the **mobile** layout only (desktop remains unchanged).
- Use a `ref` on the `DailyVideoPlayer` to call its `toggleMute()` and `toggleVideo()` methods from the mobile bottom controls.
- Remove the local `isMuted` / `isVideoOff` state (they were disconnected from the actual call) and instead read from the ref.
- The mobile layout becomes the single, clean control surface:
  - Top overlay: "EN VIVO" badge + title + time + viewers + likes (compact, single row)
  - Full-screen video (no internal overlays)
  - Bottom bar: Mic, Camera, Chat, "Finalizar" buttons with proper touch targets

### UX/UI Improvements for Mobile Streaming

- **Single control bar at the bottom** with 44px+ touch targets, frosted glass background.
- **Compact top bar** with title truncation and minimal metrics (time, viewers, likes) in a single row.
- **No duplicate badges or metrics** anywhere on screen.
- **Auto-hide top bar** after 3 seconds of inactivity (tap to show again), keeping the video unobstructed.
- **Video fills entire screen** edge-to-edge with `object-cover` and safe-area insets.

---

### Technical Details

**DailyVideoPlayer changes (forwardRef + imperative handle):**

```text
interface DailyVideoPlayerHandle {
  toggleMute: () => void;
  toggleVideo: () => void;
  leaveCall: () => void;
  isMuted: boolean;
  isVideoOff: boolean;
}
```

The component becomes a `forwardRef` component. A `useImperativeHandle` exposes the control methods. When `hideControls=true`, lines 407-511 (all overlay UI) are skipped.

**LiveStreamView mobile changes:**

```text
const playerRef = useRef<DailyVideoPlayerHandle>(null);

// Bottom controls call playerRef.current?.toggleMute(), etc.
// Read playerRef.current?.isMuted for button state
// Use a 3-second auto-hide timer for the top info bar
```

**Files modified:**
- `src/components/live/DailyVideoPlayer.tsx`
- `src/components/live/LiveStreamView.tsx`

No other files are touched. Desktop streaming experience remains exactly the same.

