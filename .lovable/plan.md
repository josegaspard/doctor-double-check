

# Plan: Fix Mobile Video Playback and Content Preview Layout

## Problem 1: Recordings saved as WebM can't play on iOS/mobile

**Root cause**: The `useLocalRecording` hook prioritizes WebM codecs when recording. iOS Safari does NOT support WebM playback at all. So every recording made from any browser gets saved as `.webm`, making it unplayable on iPhones and iPads.

**Fix (2 files)**:

### `src/hooks/cloudflare/useLocalRecording.ts`
- Reorder the MIME type priority list to try `video/mp4` FIRST
- On iOS/Safari specifically, MP4 is the only format MediaRecorder supports anyway
- On Chrome/Firefox (desktop), `video/webm;codecs=h264` produces files that are also broadly compatible
- This ensures NEW recordings are saved in a mobile-friendly format

### `src/components/recordings/RecordingVideoPlayer.tsx`
- For EXISTING `.webm` recordings on iOS, improve the error message to be more helpful and less alarming
- Remove the iOS-only check from the error handler -- instead, detect ANY playback failure and attempt a more graceful recovery:
  - If the file is `.webm` and the device can't play it, show a clear message with a suggestion
  - Add a note that future recordings will be compatible

## Problem 2: Premium content video breaks screen width on mobile

**Root cause**: In `ContentPreviewModal.tsx`, the `DialogContent` uses `sm:max-w-3xl` but on mobile (below `sm`), the dialog can overflow. The video element lacks `playsInline` (required for iOS inline playback) and `max-width` constraints.

**Fix**: `src/components/content/ContentPreviewModal.tsx`
- Add `playsInline` attribute to the `<video>` element
- Add `max-w-full` and `w-full` constraints to the dialog content on mobile
- Change `DialogContent` class to include proper mobile sizing: `max-w-[95vw] sm:max-w-3xl`
- Add `controlsList="nodownload"` to prevent download on protected content
- Add `object-contain` to the video element to prevent stretching

## Summary of changes

| File | Change |
|------|--------|
| `src/hooks/cloudflare/useLocalRecording.ts` | Reorder MIME types: MP4 first, then WebM with h264, so new recordings are mobile-compatible |
| `src/components/recordings/RecordingVideoPlayer.tsx` | Improve error UX for incompatible formats on existing recordings |
| `src/components/content/ContentPreviewModal.tsx` | Add `playsInline`, fix dialog width overflow on mobile, constrain video element |

