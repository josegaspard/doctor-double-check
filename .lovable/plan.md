

# Plan: Fix overlapping dialogs — sequential UX flow for ending live

## Problem
The confirmation dialog ("¿Finalizar transmisión?") and the EndingLiveModal ("¿Guardar como contenido premium?") overlap visually because both render simultaneously. The doctor sees two stacked modals which is confusing, especially for older users.

## Root Cause
In `handleEndLive`, `setShowEndDialog(false)` and `setShowEndingModal(true)` fire in the same render cycle. The AlertDialog closing animation hasn't completed before the EndingLiveModal opens, causing visual overlap.

## Solution
Ensure the confirmation dialog fully closes before the EndingLiveModal appears by adding a small delay (`300ms`) between closing the confirmation and opening the ending modal. This creates a clean sequential flow:

1. **Step 1** — Doctor clicks "Finalizar" → Confirmation dialog appears
2. **Step 2** — Doctor confirms → Dialog closes smoothly
3. **Step 3** — After 300ms → EndingLiveModal appears with progress stages (ending → saving → uploading)
4. **Step 4** — Choose stage: "¿Guardar como contenido premium?" with checkbox
5. **Step 5** — Done stage: Stats summary + "Ver mis grabaciones" button

## Changes

### `src/pages/DoctorGoLive.tsx`
- In `handleEndLive`: after `setShowEndDialog(false)`, add `await new Promise(r => setTimeout(r, 300))` before `setShowEndingModal(true)` to let the AlertDialog animation complete
- This single change prevents the overlap

### `src/components/live/EndingLiveModal.tsx`
- Increase font sizes for readability (older doctors): title `text-xl`, description `text-base`, button text `text-base min-h-[48px]`
- Make stat cards slightly larger with `text-xl` values
- Increase checkbox label to `text-base`

## Files to modify
1. `src/pages/DoctorGoLive.tsx` — Add 300ms delay between dialog close and modal open
2. `src/components/live/EndingLiveModal.tsx` — Increase touch targets and font sizes for accessibility

