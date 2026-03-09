

# Plan: Content Gallery PDF Thumbnails, Card UX, Doctor Dashboard & Admin Dashboard Modernization

## 1. Content Gallery — PDF Thumbnail + Card Spacing

### Problem
- PDFs show a generic icon placeholder with "PDF" text inside a colored circle — user wants a cleaner, larger PDF icon badge as the thumbnail
- Cards feel cramped on mobile (2-column grid with too many elements stacked)

### Changes to `ContentGallery.tsx` → `ContentCardThumbnail`
- For `type === 'pdf'`: render a prominent centered PDF icon placeholder with a large "PDF" label (white text on red/blue background, like a file badge), instead of the small icon circle. Skip fetching signed URLs for PDFs (no need for image thumbnail)
- Increase card body padding from `p-4` to `p-4 sm:p-5`
- Reduce description to 1 line on mobile, show doctor name more compactly
- Make category badge and date slightly less cramped by using `flex-wrap`

### Changes to `ContentCardBody`
- Title: `text-sm sm:text-base` with `line-clamp-1` on mobile, `line-clamp-2` on desktop
- Remove description entirely on mobile (keep on desktop) to reduce visual clutter
- Doctor info: keep compact, move category badge inline with date row

## 2. Doctor Dashboard — Configuration Section Visibility + Modernization

### Problem
- "Configuración" collapsible button is a plain ghost button, easily missed
- Overall dashboard looks dated

### Changes to `DoctorDashboard.tsx`
- Replace the ghost `Configuración` button with a Card-styled collapsible trigger with icon, title, subtitle, and chevron — making it look like another dashboard section rather than a hidden link
- Add a subtle border-left accent color like the quick action cards

### Changes to `DoctorQuickActions.tsx`
- Add subtle gradient/colored top border to quick action cards for a more modern feel
- Slightly rounded icon containers

### Changes to `DoctorStatsGrid.tsx`
- Add a subtle colored top-border or gradient accent to stat cards for visual freshness

## 3. Admin Dashboard — Modern Refresh

### Problem
- Dashboard looks "old" — flat cards, repetitive layout, no visual hierarchy beyond stat numbers

### Changes to `AdminDashboard.tsx`
- **Header**: Add a subtle gradient background strip behind the header area for visual depth
- **Platform Totals**: Style stat cards with gradient backgrounds instead of plain white — e.g. soft blue-to-transparent for doctors, green for patients
- **Pending Review**: Add pulsing dot or attention indicator next to non-zero pending counts
- **Module cards**: Add hover gradient effect, slightly larger icons, more padding
- Overall: increase card `rounded-xl`, add `shadow-sm` defaults, use `bg-gradient-to-br` on stat cards

## Files to modify
- `src/pages/ContentGallery.tsx` — PDF thumbnail + card body spacing
- `src/pages/DoctorDashboard.tsx` — Configuration section redesign
- `src/components/doctor/DoctorQuickActions.tsx` — Modern card accents
- `src/components/doctor/DoctorStatsGrid.tsx` — Modern stat card accents  
- `src/pages/AdminDashboard.tsx` — Visual refresh with gradients and better hierarchy

