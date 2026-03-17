

# Plan: Connection quality indicator for live stream viewers

## Approach

Reuse the existing `useConnectionQuality` hook and `ConnectionQualityIndicator` component (already working in VideoCall) inside `DailyVideoPlayer.tsx`. This makes the indicator available to all viewers automatically.

## Changes — single file: `src/components/live/DailyVideoPlayer.tsx`

1. **Import** `useConnectionQuality` and `ConnectionQualityIndicator`
2. **Call the hook** passing `callRef.current` and `isConnected`:
   ```tsx
   const connectionStats = useConnectionQuality(callRef.current, isConnected);
   ```
3. **Render the indicator** inside the wrapper div, visible only for non-owner viewers when connected:
   ```tsx
   {!isOwner && isConnected && (
     <ConnectionQualityIndicator stats={connectionStats} />
   )}
   ```

The `ConnectionQualityIndicator` already has absolute positioning (`absolute top-3 left-3 z-30`), expandable stats panel, and mobile-friendly styling — no additional work needed.

