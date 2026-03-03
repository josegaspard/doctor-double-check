

# Fix: All Lives Should Always Save to Recordings

## Problem
When a doctor sets `enableRecording = false` in the setup form, the local recording is never started (`localRecording.startRecording` is skipped), and at end time the upload is skipped entirely. This means those lives never appear in "Grabaciones".

## Solution

**File: `src/pages/DoctorGoLive.tsx`** — 2 changes:

1. **Always start recording** (line ~148): Remove the `if (config.enableRecording)` guard around `localRecording.startRecording(stream)` — always call it regardless of the toggle.

2. **Always upload recording** (line ~195-210): Change the condition from `enableRecording && localBlob && localBlob.size > 0` to just `localBlob && localBlob.size > 0`. The `enableRecording` flag will only control whether a `price` is set (price=0 when disabled, user's chosen price when enabled).

The `enableRecording` toggle in the setup form remains — it now controls whether the recording is **premium (paid)** vs **free**, not whether it's recorded at all.

## Files to modify
- `src/pages/DoctorGoLive.tsx` — Remove recording guards so all lives are always recorded and uploaded to the recordings table

