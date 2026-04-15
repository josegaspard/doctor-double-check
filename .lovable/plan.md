

# Plan: Unify Specialties System-Wide + Soften Background

## Problem
The full 110+ specialties list only exists in `src/pages/Doctors.tsx`. Six other files still use the old short list (~30 specialties), causing inconsistency across the platform.

## Changes

### 1. Create shared specialties constant
**New file: `src/lib/specialties.ts`**
- Export the complete 110+ specialties array (with `value` and `labelKey` format for filter components)
- Export a plain string array version for dropdowns (onboarding, live setup, meetings, clinical sessions)
- Include `'Otra especialidad'` as the last option for free-text entry

### 2. Update all files to use shared constant

| File | Current list size | Format used |
|------|------------------|-------------|
| `src/pages/Doctors.tsx` | 110+ (object array) | `{ value, labelKey }` |
| `src/pages/RecordingsGrid.tsx` | ~30 (object array) | `{ value, labelKey }` |
| `src/pages/ContentGallery.tsx` | ~30 (object array) | `{ value, labelKey }` |
| `src/pages/ClinicalSessions.tsx` | ~30 (string array) | plain strings |
| `src/components/meetings/MeetingCreateDialog.tsx` | ~30 (string array) | plain strings |
| `src/components/live/LiveSetupForm.tsx` | ~30 (string array) | plain strings |
| `src/pages/Onboarding.tsx` | ~30 (string array) | plain strings |
| `supabase/functions/seed-demo-users/index.ts` | ~15 (string array) | plain strings |

Each file will replace its local `SPECIALTIES` / `MEDICAL_SPECIALTIES` constant with an import from `src/lib/specialties.ts`.

### 3. Soften decorative background
**File: `src/components/layout/DecorativeBackground.tsx`**
- Reduce filled circle opacities from `0.05/0.04/0.03` to `0.03/0.025/0.02`
- Reduce ring border opacities from `0.08/0.06` to `0.05/0.04`
- Reduce dot opacities from `0.10-0.15` to `0.06-0.08`

## Technical Notes
- The shared file exports two formats: `SPECIALTIES_FILTER` (objects with value/labelKey, includes "Todas" first) for filter UIs, and `SPECIALTIES_LIST` (plain strings, includes "Otra especialidad" last) for selection dropdowns.
- No database changes needed -- specialties are stored as free text in `doctor_profiles.specialty`.
- Total files modified: 9 (1 new + 8 updated).

