

# Fix: Live Thumbnail Not Visible on Cards + Image Optimization

## Root Cause

Two issues:

1. **CSS positioning bug**: The `<img>` tag in `LivesGrid.tsx` (line 43-49) lacks `absolute inset-0` positioning. The parent `div` is `relative aspect-video`, but the `<img>` is in normal flow, not absolutely positioned to fill the container. This causes it to not render correctly within the aspect-ratio box.

2. **No image compression**: Thumbnails are uploaded at full resolution. Large images may load slowly or fail silently (the `onError` handler hides the image on failure).

## Plan

### 1. Fix image positioning in LiveCard (`src/pages/LivesGrid.tsx`)
- Add `absolute inset-0` to the `<img>` tag so it fills the aspect-video container properly
- This matches the pattern used in `RecordingsGrid.tsx` and other card components

### 2. Compress thumbnail on upload (`src/components/live/LiveSetupForm.tsx`)
- Add a client-side resize function that compresses the image to max 800px wide, JPEG quality 0.7 using canvas
- Apply before setting `thumbnailFile` state
- Add a note in the UI recommending images under 1MB

### 3. Same fix for `RecordingsGrid.tsx` if needed
- Verify and fix the same positioning pattern there

### Files to modify
- `src/pages/LivesGrid.tsx` -- Add `absolute inset-0` to thumbnail `<img>`
- `src/components/live/LiveSetupForm.tsx` -- Add client-side image compression before upload, update size recommendation text

