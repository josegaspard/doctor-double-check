

# Plan: Always-visible controls on mobile live stream video

## Problem
With the chat now auto-opening on mobile, the bottom control bar (mute, camera, end stream) gets hidden behind the chat overlay which takes up the bottom 60% of the screen. The streamer can't access controls.

## Solution
Move the control buttons from the absolute bottom of the screen to **inside the video area**, positioned just above where the chat overlay starts. They'll always be visible regardless of chat state.

### File: `src/components/live/LiveStreamView.tsx`

1. **Move the control bar inside the video container** (the `flex-1 relative overflow-hidden` div, line 125) instead of being an absolute-bottom overlay on the full screen.
2. Position controls at the **bottom of the video area** with `absolute bottom-2` inside the video container, so they float over the video but above the chat panel.
3. Remove the old absolute-bottom control bar (lines 138-189).
4. Keep all buttons (mute, camera, chat toggle, end stream) with the same styling — compact circular buttons with semi-transparent backgrounds.
5. Add `z-30` so they stay above the video element.

This ensures controls are always visible in the top 40% of the screen (the video area) even when the chat sheet occupies the bottom 60%.

