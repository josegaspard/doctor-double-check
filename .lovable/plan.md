

# Apply SearchableFilter to RecordingsGrid & ContentGallery + Enhanced Filters

## Problem
`/recordings` and `/content` still render 110+ specialty buttons/chips (both desktop sidebar and mobile horizontal scroll). Only `/doctors` uses the new `SearchableFilter`. LivesGrid is fine — it only shows specialties from active lives (dynamic, small list).

## Changes

### 1. `src/pages/RecordingsGrid.tsx`
**Desktop sidebar (lines 212-232):** Replace the 110-button specialty list with `<SearchableFilter>` using the specialty values from `SPECIALTIES`.
**Mobile (lines 304-319):** Replace the 110-chip horizontal scroll with `<SearchableFilter>` in a compact row alongside a tags filter.
**State change:** `selectedSpecialty` switches from `'Todas'` default to `''` (empty = all) to match SearchableFilter's convention.
**Additional filters:**
- Add a **doctor name** SearchableFilter (extracted from recordings list) so users can filter by doctor
- Tags already exist but also convert to SearchableFilter for consistency

### 2. `src/pages/ContentGallery.tsx`
**Desktop sidebar (lines 454-474):** Replace specialty buttons with `<SearchableFilter>`.
**Mobile (lines 571-586):** Replace specialty chip scroll with `<SearchableFilter>` button.
**State change:** Same `'Todas'` → `''` convention.
**Additional filters:**
- Categories already exist as buttons — convert to `<SearchableFilter>` for consistency
- Content type filter stays as small button group (only 5 items, works fine)

### 3. No changes to `LivesGrid.tsx`
It only shows specialties from currently active lives (typically 0-5), so a simple chip row is appropriate.

### 4. No changes to `SearchableFilter.tsx`
Component is already fully functional and responsive.

## Layout for mobile filters (both pages)
```
[🔬 Especialidad ▼] [🏷️ Categoría ▼]
[Content filter chips: All | Free | Paid | Purchased]
```

Two SearchableFilter buttons side by side, then access/type chips below.

## Technical details
- Import `SearchableFilter` and icons (`Stethoscope`, `Tag`, `MapPin`)
- Extract specialty options: `SPECIALTIES.filter(s => s.value !== 'Todas').map(s => s.value)`
- Filter logic: `selectedSpecialty === '' || rec.specialty === selectedSpecialty` (unchanged semantics)
- 3 files modified total

