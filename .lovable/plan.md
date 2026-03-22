

# Plan: Fix shared clickUrl across all placements

## Problem
There is a single `clickUrl` state variable (line 94) shared across ALL placement upload forms. When you type a URL in one placement's input, it shows in every other placement's input too. And when you upload a creative, it uses whatever is in that single shared field.

## Fix

### `src/pages/AdvertiserDashboard.tsx`
- Replace `const [clickUrl, setClickUrl] = useState('')` with `const [clickUrls, setClickUrls] = useState<Record<string, string>>({})` — a map of `placementId → clickUrl`
- In the placement upload loop (line 444), change the Input to read/write from `clickUrls[pl.id]` instead of the shared `clickUrl`
- In `uploadCreative` (line 203), pass the placement-specific URL: `clickUrls[placementId]` instead of `clickUrl`
- After successful upload, only clear that placement's URL: `setClickUrls(prev => ({ ...prev, [placementId]: '' }))`

## Files to modify
1. `src/pages/AdvertiserDashboard.tsx` — replace single `clickUrl` state with per-placement map

