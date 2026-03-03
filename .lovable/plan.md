

# Fix: Live Preview Not Showing Video in Grid Cards

## Root Cause

The console shows: **"You are attempting to use multiple call instances simultaneously"**. Daily.co by default only allows ONE `createCallObject` at a time. The component is missing the `allowMultipleCallInstances: true` flag, so only the first card connects and the rest silently fail.

## Solution

**File: `src/components/live/LivePreviewPlayer.tsx`** -- one critical fix:

Add `allowMultipleCallInstances: true` to the `createCallObject` call on line 87:

```js
const call = DailyIframe.createCallObject({
  subscribeToTracksAutomatically: true,
  allowMultipleCallInstances: true,
  dailyConfig: {} as any,
});
```

This single missing flag is preventing all preview players from connecting. With it enabled, up to 4 cards (per the existing MAX_PREVIEWS limit) will each create their own Daily instance and receive the doctor's video track.

## Files to modify
- `src/components/live/LivePreviewPlayer.tsx` -- add `allowMultipleCallInstances: true` to `createCallObject`

