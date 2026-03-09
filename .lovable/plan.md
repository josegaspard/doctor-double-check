

# Plan: Doctor Profile Card UX/UI Redesign

## Problem
The current doctor profile card is visually cluttered — too many badges, stats, office hours, bio, CTAs, and "how it works" all crammed into a single card. For older adults especially, this is overwhelming.

## Solution: Split into Clear Visual Sections

### 1. **Hero Section** (lines 414-475) — Simplify
- Remove the `Separator` divider, use spacing instead
- Move rating **inline** with the name (next to specialty) instead of a separate row
- Reduce badge count on mobile: show only the most important (verified + rank), hide followers count on mobile (`hidden sm:inline-flex`)
- Make avatar slightly larger on mobile (`w-24 h-24`) for better recognition

### 2. **Stats Grid** (lines 495-521) — More visual clarity
- Add subtle icons inside each stat cell for quicker scanning
- Use distinct background tints per stat (green for consultations, premium for fee, blue for location)

### 3. **Office Hours** (lines 523-573) — Compact redesign
- Show only active days (not all 7 with inactive grayed out — reduces clutter)
- Inline the time range with the availability badge on one row
- Smaller overall footprint

### 4. **CTA Buttons** (lines 577-609) — Prioritize primary action
- Make the primary CTA (Start Consultation) visually dominant with `size="lg"`
- Secondary buttons (Lives, Subscribe) smaller and outline
- On mobile: primary button full-width, secondary buttons side by side in a row

### 5. **"How it works"** (lines 611-628) — Move below the card
- Extract from the main card into its own lightweight section below
- This declutters the main profile card significantly

### 6. **Bio** (lines 480-492) — Keep but refine
- Move bio after CTA buttons (users care about actions first)
- Or keep position but reduce visual weight

## Files to Modify

1. **`src/pages/DoctorProfile.tsx`** — Restructure the card layout:
   - Inline rating with name/specialty
   - Hide followers badge on mobile
   - Larger avatar on mobile
   - Active-only office day chips
   - Inline time + availability
   - Primary CTA prominence
   - Move "How it works" outside main card
   - Add stat cell icons + color tints

No translation changes needed — all keys already exist.

