

# Plan: Mobile controls inside video + fullscreen toggle

## Current problem
The chat overlay is `absolute` with `z-40` covering 60% of the screen, while controls are `z-30` inside the video area — they get buried under the chat. The controls need to always be visible inside the video portion.

## Changes — `src/components/live/LiveStreamView.tsx`

### 1. Add fullscreen state
Add `const [isFullscreen, setIsFullscreen] = useState(false)` to track when the user wants the video to fill the entire screen.

### 2. Restructure mobile layout from absolute overlay to flex split
Replace the current absolute-positioned chat overlay with a proper **flex column layout**:
- When `isFullscreen = false`: video takes top ~40%, chat takes bottom ~60% — both as flex children (not absolute). Controls float inside the video container with `absolute bottom-2 z-30`.
- When `isFullscreen = true`: video takes 100% of screen, chat is hidden. Controls remain visible inside the video area.

### 3. Add fullscreen button to the control bar
Add a `Maximize`/`Minimize` icon button between the camera toggle and the chat toggle. Tapping it toggles `isFullscreen`:
- **Enter fullscreen**: hides chat, video fills screen, controls stay visible.
- **Exit fullscreen**: restores the split view with chat below.

### 4. Control bar always visible
The control bar stays at `absolute bottom-2` inside the video container div. Since the chat is now a sibling flex child (not an absolute overlay), it can never cover the controls.

### Buttons in order (matching reference image style):
Mute | Camera | Fullscreen | Chat toggle | End stream

