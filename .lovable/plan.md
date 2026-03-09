

# Plan: Fix Missing Translations + Content Gallery Mobile + Doctor Office Hours on Profile

## Issues Identified

1. **`login.loginDescription`** — missing from both es.ts and en.ts, shows raw key on login page
2. **`search.tip`** — missing from both es.ts and en.ts, shows raw key in search dialog
3. **Content Gallery mobile** — cards use `grid-cols-2` on mobile which makes content cramped (screenshot shows PDF preview too small). Need single column on very small screens.
4. **Doctor office hours on profile** — removed from Doctors listing, needs to appear on DoctorProfile page. The `get_doctor_public_profile` RPC already returns `office_hours_start`, `office_hours_end`, `office_days`.

## Changes

### 1. `src/lib/i18n/es.ts` — Add missing keys
- `login.loginDescription`: `'Ingresa con tu cuenta para continuar'`
- `search.tip`: `'Prueba buscar por nombre de doctor, especialidad o tema'`

### 2. `src/lib/i18n/en.ts` — Add missing keys
- `login.loginDescription`: `'Sign in to your account to continue'`
- `search.tip`: `'Try searching by doctor name, specialty, or topic'`

### 3. `src/pages/ContentGallery.tsx` — Fix mobile layout
- Change grid from `grid-cols-2 sm:grid-cols-2` to `grid-cols-1 sm:grid-cols-2` so mobile shows single-column cards that are properly sized
- Ensure card thumbnails and text have adequate space on small screens

### 4. `src/pages/DoctorProfile.tsx` — Add office hours section
- Extend `DoctorData` interface with `officeHoursStart`, `officeHoursEnd`, `officeDays`
- Populate from the RPC response (`doctorProfile.office_hours_start`, etc.)
- Add a visually clean office hours card after the stats grid, showing:
  - Active days as colored chips
  - Time range (e.g., "08:00 - 20:00")
  - Current availability indicator (green dot if within hours, gray if not)
- Fully responsive: stacks nicely on mobile with compact layout
- Add i18n keys for office hours labels (`doctorProfile.officeHours`, `doctorProfile.availableNow`, `doctorProfile.notAvailableNow`, day names)

### 5. Broad missing translation scan
- Will also scan for any other `t('...')` calls that return raw keys and add them

## Files to Modify
1. `src/lib/i18n/es.ts`
2. `src/lib/i18n/en.ts`
3. `src/pages/ContentGallery.tsx`
4. `src/pages/DoctorProfile.tsx`

