

# Smart Searchable Filters for Specialties & Cities

## Problem
The Doctors directory has 110+ specialties rendered as plain button lists — on desktop as a long sidebar and on mobile as a horizontal scroll of 110+ chips. This is unusable. Cities are a hardcoded list of 8 items with no search.

## Solution
Create a reusable `SearchableFilter` combobox component using the existing `Popover` + `Command` (cmdk) primitives already in the project. Users can either browse the list or type to filter instantly. Works on both desktop sidebar and mobile.

## Component Design

**New file: `src/components/filters/SearchableFilter.tsx`**
- Props: `options: string[]`, `value: string`, `onChange: (val: string) => void`, `placeholder: string`, `emptyLabel: string`, `icon?: LucideIcon`
- Uses `Popover` + `Command` + `CommandInput` + `CommandList` + `CommandItem` + `CommandEmpty`
- Trigger button shows selected value with a chevron; full-width on mobile
- Search input inside popover filters options as user types
- Selected item gets a checkmark
- Mobile: popover renders as a `Drawer` (using existing `useIsMobile` hook) for better touch UX
- 48px touch targets per item (per project memory)

## Changes to `src/pages/Doctors.tsx`

### Desktop Sidebar (lines 370-427)
- Replace the 110-button specialty list with `<SearchableFilter>` 
- Replace the city button list with `<SearchableFilter>`
- Sidebar becomes compact (2 filter widgets + clear button)

### Mobile (lines 449-482)  
- Replace the 110-chip horizontal scroll with a single `<SearchableFilter>` button that opens a searchable drawer
- Replace the city chip scroll with a similar `<SearchableFilter>` button
- Both shown as a compact row: `[🔬 Especialidad ▼] [📍 Ciudad ▼]`
- Active filters shown as dismissible badges below

### Cities
- Fetch unique cities from `doctor_profiles` via a simple query instead of the hardcoded 8-city array, so the list is always current

## Technical Details
- Uses existing `cmdk` package (already installed) and `Popover`/`Drawer` components
- `CommandInput` handles the search/filter natively — no custom debounce needed
- Responsive: `Popover` on desktop, `Drawer` on mobile (pattern already used elsewhere in the project)
- All items use `spec.value` directly (no i18n keys, matching the fix already applied)
- Total files: 1 new component + 1 modified page

