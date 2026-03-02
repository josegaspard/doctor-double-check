
# Plan: Fix Live Transmit Button, Recording Playback on Mobile, and Screen Share

## 1. Fix "Iniciar Transmision" button hidden on mobile

**Root cause**: The LiveSetupForm sticky submit button uses `z-40`, but MainLayout's bottom navigation bar uses `z-50`. The bottom nav covers the transmit button entirely on mobile.

**Fix in `src/components/live/LiveSetupForm.tsx`**:
- Change the sticky button's `z-index` from `z-40` to `z-50` 
- Add extra bottom padding to account for the bottom nav height (~72px) so the button sits ABOVE the nav bar
- Alternatively, add `pb-20` to the form container to ensure scrollable content isn't hidden behind the sticky button + bottom nav

## 2. Fix recordings not viewable on mobile (iOS/iPad)

**Root cause**: Local recordings are saved as `.webm` files (from `useLocalRecording` using MediaRecorder). iOS Safari does NOT fully support WebM video playback. When a `storage:` URL points to a `.webm` file, the native `<video>` element fails silently on iOS.

**Fixes in `src/components/recordings/RecordingVideoPlayer.tsx`**:
- Add `playsInline` attribute to the native video element (required for iOS inline playback)
- Add an `onError` handler that detects WebM on iOS and shows a helpful message ("This recording format is not supported on this device. Please try Chrome or a desktop browser.")
- Add a user-friendly error state instead of a blank screen

**Fixes in `src/components/recordings/CloudflareRecordingPlayer.tsx`**:
- The controls use `group-hover:opacity-100` which does NOT work on touch devices -- controls are invisible on mobile
- Fix: Make controls always visible on mobile (remove opacity-0 on touch devices) or add a tap-to-toggle behavior
- Add `playsInline` attribute to the video element

## 3. Remove screen share button on mobile

Screen sharing (`getDisplayMedia`) is not supported on iOS Safari and most mobile browsers. Showing the button causes confusion.

**Fix in `src/components/videocall/VideoCallControls.tsx`**:
- Import `useIsMobile` hook
- Conditionally render the screen share button: only show it when `isDoctor && !isMobile`

**Fix in `src/components/live/LiveStreamView.tsx`**:
- Confirm there's no screen share button in the mobile live view (already correct -- no screen share button exists in mobile layout)

## 4. Video call screen share PiP (already implemented)

The `renderVideoTracks` function in `VideoCall.tsx` already handles `screenVideo` tracks from remote participants: screen share becomes the main view (`object-fit: contain`) and the remote camera moves to a PiP. No changes needed.

## Summary of file changes

| File | Change |
|------|--------|
| `src/components/live/LiveSetupForm.tsx` | Fix z-index on sticky button, add bottom padding |
| `src/components/recordings/RecordingVideoPlayer.tsx` | Add playsInline, onError handler for WebM on iOS |
| `src/components/recordings/CloudflareRecordingPlayer.tsx` | Fix controls visibility on mobile touch devices, add playsInline |
| `src/components/videocall/VideoCallControls.tsx` | Hide screen share button on mobile devices |
