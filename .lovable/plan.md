

# Plan: Recordings Page — Remove Ads + Decorative Background

## Changes to `src/pages/RecordingsGrid.tsx`

### 1. Remove advertising
- **Line 2**: Remove `AdBanner` import
- **Line 182**: Remove `<AdBanner placementName="recordings_top_banner" className="mb-4" />`

### 2. Add decorative background with blue circles
Replace the plain white container with a styled background that includes:
- A gradient base: `bg-gradient-to-b from-primary/5 via-background to-background`
- Decorative floating blue circles using `absolute` positioned `div` elements with `rounded-full`, `bg-primary/5` and `bg-secondary/5` at various sizes and positions, with `pointer-events-none` so they don't interfere with content
- All circles sit behind content via `z-0`, content gets `relative z-10`

### 3. Add a hero header card
Replace the plain `h1` + subtitle (lines 185-219) with a styled card header:
- Gradient background card: `bg-gradient-to-br from-primary/10 via-secondary/5 to-transparent`
- Rounded corners, subtle border, padding
- Same content (title, subtitle, buttons) but wrapped in the styled card
- Fully responsive — stacks on mobile, row on desktop

### Visual result
The page gets a subtle medical-themed decorative background with soft blue circles at different opacities and sizes, plus a professional hero header — all fully responsive without obscuring any content.

## Technical Summary

| # | What | Detail |
|---|------|--------|
| 1 | Remove AdBanner import + usage | Lines 2, 182 |
| 2 | Add decorative circle background | Absolute-positioned divs behind content |
| 3 | Hero header card | Gradient card wrapping existing header |

Single file change: `src/pages/RecordingsGrid.tsx`

