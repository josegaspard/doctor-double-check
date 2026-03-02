
# Plan: Fix Doctor Card Design, Location/Geolocation, Heart Button Colors, and Availability Status

## Problems Identified

1. **Card layout breaks with nearby mode** -- The location + distance info overflows within the stats row on mobile, causing visual breakage
2. **Heart/favorite button colors** -- The heart button uses a teal background when followed (screenshot shows dark teal square with red heart), needs better color balance
3. **Availability status NEVER shows as "available"** -- Critical bug: the code compares English day names from DB (`monday`, `tuesday`) against Spanish day names (`lunes`, `martes`), so the check always fails
4. **Doctor can already set location** from UserProfile.tsx (text input), but there's no geolocation-based address option
5. **No location field during onboarding** for doctors

## Changes

### 1. Fix Availability Status Bug (CRITICAL)

**File: `src/pages/Doctors.tsx` (lines 460-473)**

The current code uses Spanish day names:
```js
const currentDay = ['domingo', 'lunes', 'martes', ...][now.getDay()];
```
But `office_days` in the DB stores English: `['monday', 'tuesday', ...]`

Fix: Change to English day names to match the database values.

### 2. Fix Card Layout for Nearby Mode

**File: `src/pages/Doctors.tsx` (lines 399-484)**

Restructure the card content area:
- Move location + distance to its own row below the stats, so it doesn't overflow the inline stats
- On mobile, always show location (currently hidden on mobile unless nearbyMode)
- Make the distance badge part of the location row, not squeezed inline with rating/followers
- Add `line-clamp-1` to location text and bio to prevent overflow

### 3. Fix Heart Button Color Balance

**File: `src/pages/Doctors.tsx` (lines 277-284)**

Current: `variant="secondary"` when following (gives dark teal bg)
Fix: When following, use a softer style -- `bg-destructive/10 text-destructive border-destructive/20` so the filled heart sits on a light pink/red background instead of a dark teal square.

When not following: keep `variant="outline"` but add `hover:bg-destructive/5 hover:text-destructive` for a warm hover effect.

### 4. Add Location Input to Doctor Onboarding (Step 2)

**File: `src/pages/Onboarding.tsx`**

Add a location field with two options for doctors in step 2 (after specialty/cedula):
- A text `Input` for manual city entry (e.g., "Ciudad de Mexico")
- A "Use my location" `Button` that calls `navigator.geolocation.getCurrentPosition()`, reverse-geocodes using the existing `CITY_COORDS` map to find the nearest city name, and auto-fills the input
- Save to `doctor_profiles.location` during `handleSubmit`

### 5. Add Geolocation Button to Doctor's Profile Location Edit

**File: `src/pages/UserProfile.tsx`**

In the location editing section (lines 593-625), add a small "Use my location" button next to the text input that auto-detects and fills the nearest city.

### 6. i18n Keys

**Files: `src/lib/i18n/en.ts`, `src/lib/i18n/es.ts`**

Add keys:
- `onboarding.location` / `onboarding.locationPlaceholder`
- `onboarding.useMyLocation` / `onboarding.detectingLocation`
- `profile.useMyLocation`

## Technical Details

### Availability day mapping fix:
```typescript
// BEFORE (broken -- Spanish names don't match DB)
const currentDay = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'][now.getDay()];

// AFTER (matches DB values)
const currentDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
```

### Heart button styling:
```tsx
<Button
  variant="outline"
  size="icon"
  className={`h-10 w-10 flex-shrink-0 transition-all ${
    isFollowing 
      ? 'bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20' 
      : 'hover:bg-destructive/5 hover:text-destructive hover:border-destructive/20'
  }`}
>
  <Heart className={`w-4 h-4 ${isFollowing ? 'fill-current' : ''}`} />
</Button>
```

### Card layout restructure:
```tsx
{/* Stats row: rating + followers only */}
<div className="flex items-center gap-3 text-xs sm:text-sm text-muted-foreground">
  <span>star + rating</span>
  <span>users + followers</span>
</div>

{/* Location row (separate, always visible) */}
{doctor.location && (
  <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
    <MapPin className="w-3 h-3 flex-shrink-0" />
    <span className="truncate">{doctor.location}</span>
    {nearbyMode && distance badge}
  </div>
)}

{/* Availability row */}
<div className="...">available/not available</div>
```

### Geolocation reverse-geocode helper:
Reuse the existing `CITY_COORDS` map and `haversineDistance` function to find the nearest known city:
```typescript
function reverseGeocode(lat: number, lng: number): string {
  let nearest = 'Ciudad de Mexico';
  let minDist = Infinity;
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    const dist = haversineDistance(lat, lng, coords.lat, coords.lng);
    if (dist < minDist) { minDist = dist; nearest = city; }
  }
  // Capitalize
  return nearest.replace(/\b\w/g, c => c.toUpperCase());
}
```

## Files Modified

| File | Change |
|------|--------|
| `src/pages/Doctors.tsx` | Fix day names, restructure card layout, fix heart button colors |
| `src/pages/Onboarding.tsx` | Add location field with geolocation for doctor onboarding |
| `src/pages/UserProfile.tsx` | Add "Use my location" button to location edit |
| `src/lib/i18n/en.ts` | Add location-related i18n keys |
| `src/lib/i18n/es.ts` | Add location-related i18n keys |
