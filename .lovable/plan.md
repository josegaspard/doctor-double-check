

# Plan: Auto-open chat on mobile + Fix vertical video orientation

## Problem 1: Chat hidden on mobile during live stream
In `LiveStreamView.tsx` line 50, `mobileChatOpen` defaults to `false`. On mobile, the doctor has to tap the chat button to see comments. It should auto-open.

## Problem 2: Portrait recordings display sideways
When a doctor streams from a phone held vertically, the MediaRecorder captures the raw stream. The recording player forces an `aspect-video` (16:9) container, which can cause portrait videos to display incorrectly. The player needs to detect the video's natural dimensions and adapt the container.

## Changes

### 1. `src/components/live/LiveStreamView.tsx`
- Change `mobileChatOpen` initial state from `false` to `true` so the chat overlay opens automatically on mobile when the stream starts.

### 2. `src/components/recordings/RecordingVideoPlayer.tsx`
- Remove the hardcoded `aspect-video` wrapper on the storage video player.
- Add an `onLoadedMetadata` handler that detects if the video is portrait (naturalHeight > naturalWidth) and dynamically switches the container to a portrait-friendly aspect ratio.
- Keep `object-contain` so the video always displays with correct proportions regardless of orientation.

### 3. `src/components/live/DailyVideoPlayer.tsx`
- On mobile, the local video element currently uses `object-cover`. This is fine for the live view (fills the screen). No change needed for the live experience itself — this is purely about how the recorded output looks.

### 4. `src/pages/RecordingPlayer.tsx`
- The wrapper around `RecordingVideoPlayer` also has no forced aspect ratio of its own, so no changes needed here.

## Summary
- Two focused changes: auto-open mobile chat + responsive video container for portrait recordings.

