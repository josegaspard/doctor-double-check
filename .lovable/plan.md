

# Plan: Doctor Profile Action Buttons — Single Row + MXN Color Fix

## Changes

### 1. `src/pages/DoctorProfile.tsx` (lines 615-637)
- Change the secondary actions from `grid-cols-2` + separate block row → **single row with all 3 buttons**: Subscribe, Ver Lives, Bloquear
- Use `flex` with `gap-2` and equal sizing so all 3 fit in one row
- Remove the separate "Tertiary" block section — move BlockUserButton inline

### 2. `src/components/currency/PriceDisplay.tsx` (line 29)
- The currency label uses `text-muted-foreground` which is invisible on the dark primary button background
- Add an `inheritColor` prop (or just use `inherit` when inside a button context)
- Simpler fix: change line 29 to use `text-current opacity-70` instead of `text-muted-foreground`, so it inherits the parent's text color (white on primary buttons, dark on light backgrounds)

## Files
1. `src/pages/DoctorProfile.tsx` — Flatten 3 buttons into 1 row
2. `src/components/currency/PriceDisplay.tsx` — Fix currency label to inherit parent color

