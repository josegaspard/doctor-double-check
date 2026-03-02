

# Plan: Doctor Profile Mobile UX/UI Overhaul

## Current Issues (from screenshot)
- Profile card uses a horizontal flex layout (`flex-row`) that wastes space on mobile -- avatar is small and left-aligned, text crammed to the right
- Bio text is untruncated, pushing stats and action buttons below the fold
- Badges and rating are crowded in a single row
- Stats grid and CTA buttons are barely visible (require scrolling)
- "How it works" section is hardcoded in Spanish
- Overall layout feels like a desktop page shrunk, not a mobile-native design

## Redesigned Mobile Layout

On mobile (below `sm`), restructure to a centered, app-like profile:

```text
+----------------------------------+
|        [Avatar - 80px]           |
|        Dr. Jeringa               |
|        Cardiologia               |
|   [Nuevo] [Verificado] [7 seg]  |
|          * 4.5                   |
+----------------------------------+
|  Bio (max 3 lines, expandable)  |
+----------------------------------+
|   16          $3500       CDMX   |
| Consultas  Orientacion  Ubicacion|
+----------------------------------+
| [Suscribirse]  [Consultar] [heart]|
| [Ver Lives]    [Bloquear]        |
+----------------------------------+
```

On desktop (`sm+`), keep the current horizontal layout with minor polish.

## Specific Changes

### File: `src/pages/DoctorProfile.tsx`

1. **Mobile-first hero section**: On mobile, center the avatar above the name/specialty. Use `flex-col items-center text-center` below `sm`, and `flex-row` on `sm+`
2. **Larger mobile avatar**: Increase from `w-24 h-24` to `w-20 h-20` on mobile (centered) -- already decent but center it
3. **Bio truncation**: Add `line-clamp-3` on mobile with a "Read more" toggle to expand
4. **Stats grid**: Make it always `grid-cols-3` with equal sizing, move location into the grid if present
5. **CTA buttons**: Stack vertically on mobile with full width, each `h-12` for better touch targets
6. **"How it works" section**: Translate all hardcoded Spanish strings using i18n keys
7. **Rating pill**: Move below the name on mobile for better visual hierarchy
8. **Live banner**: Tighten padding on mobile

### File: `src/lib/i18n/es.ts` and `src/lib/i18n/en.ts`

Add keys for the "How it works" section:
- `doctorProfile.howItWorks` 
- `doctorProfile.step1Title`, `doctorProfile.step1Desc`
- `doctorProfile.step2Title`, `doctorProfile.step2Desc`  
- `doctorProfile.step3Title`, `doctorProfile.step3Desc`
- `doctorProfile.readMore`, `doctorProfile.readLess`

## Technical Details

### Layout restructure (mobile-first):
```tsx
{/* Hero section */}
<div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left gap-4 sm:gap-6">
  {/* Avatar */}
  <div className="relative flex-shrink-0">
    <img className="w-20 h-20 sm:w-24 sm:h-24 rounded-full ..." />
  </div>
  
  {/* Info */}
  <div className="flex-1 w-full">
    <h1>...</h1>
    <p>specialty</p>
    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
      badges...
    </div>
    {/* Rating */}
    <div className="flex items-center justify-center sm:justify-start gap-1 mt-2">
      star + rating
    </div>
  </div>
</div>
```

### Bio with expand/collapse:
```tsx
const [bioExpanded, setBioExpanded] = useState(false);

{doctor.bio && (
  <div>
    <p className={!bioExpanded ? 'line-clamp-3 sm:line-clamp-none' : ''}>
      {doctor.bio}
    </p>
    <button className="sm:hidden text-primary text-sm mt-1"
      onClick={() => setBioExpanded(!bioExpanded)}>
      {bioExpanded ? t('doctorProfile.readLess') : t('doctorProfile.readMore')}
    </button>
  </div>
)}
```

### CTA buttons full-width on mobile:
```tsx
<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
  <SubscribeButton ... className="w-full sm:w-auto" />
  <Button className="w-full sm:w-auto h-12 sm:h-11">Consultar</Button>
  <Button className="w-full sm:w-auto h-12 sm:h-11">Ver Lives</Button>
</div>
```

## Summary of Files

| File | Change |
|------|--------|
| `src/pages/DoctorProfile.tsx` | Restructure to centered mobile-first layout, bio truncation, full-width CTAs, translate hardcoded strings |
| `src/lib/i18n/en.ts` | Add `howItWorks`, `step1-3`, `readMore/readLess` keys |
| `src/lib/i18n/es.ts` | Add matching Spanish keys |

