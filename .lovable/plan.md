

# Plan: Chat & Prescriptions Mobile UX + Doctor Rank System + Video Thumbnails Fix

## 1. Chat Mobile UX Optimization

### `ChatSessionsList.tsx`
- Increase touch targets: avatar `w-12 h-12`, session item padding `p-3.5`
- Larger font for names: `text-base font-semibold` instead of `text-sm`
- Larger last-message preview: `text-sm` instead of `text-xs`
- Search input: taller `h-11` with `text-base` for elderly users
- Tab triggers: `h-12` with `text-sm` font

### `ChatMessagesPanel.tsx`
- Message input: `h-12` with `text-base` placeholder for readability
- Send button: `h-12 w-12` for better tap target
- Message bubbles area: increase `space-y-4` for clearer separation

### `ChatHeader.tsx`
- Make name `text-base` instead of `text-sm`
- Action buttons: `h-10 w-10` on mobile for better tap targets
- Back button: larger `h-10 w-10`

### `ChatMessageBubble.tsx`
- Increase message text to `text-sm` minimum (check current)
- Timestamps: `text-xs` (keep readable)

## 2. Prescriptions Mobile UX Optimization

### `Prescriptions.tsx`
- "Nueva Receta" button: larger `h-12` with `text-base` on mobile
- Patient picker dialog: full-screen on mobile, larger patient buttons `p-4` with `h-12` avatars
- Search input in dialog: `h-11 text-base`

### `PrescriptionsList.tsx`
- Prescription cards: increase padding to `p-5` on mobile
- Icon container: `w-12 h-12` instead of `w-10 h-10`
- Patient/doctor name: `text-base font-semibold`
- Medication badges: `text-sm` instead of `text-xs`
- Download button: `h-10` with larger text
- Manage/Settings button: `h-10` with clear label
- Floating delete bar: larger button `h-12`

## 3. Doctor Rank System (Complete)

### Database Migration
Create a `doctor_ranks` table with predefined ranks:
```sql
CREATE TABLE public.doctor_ranks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,           -- e.g. "Nuevo", "Activo", "Destacado", "Experto", "Élite"
  display_name text NOT NULL,
  icon text NOT NULL,           -- "shield", "star", "award", "crown", "gem"
  color text NOT NULL,          -- tailwind color key: "info", "success", "warning", "premium", "purple"
  min_consultations int DEFAULT 0,
  min_earnings numeric DEFAULT 0,
  min_months_active int DEFAULT 0,
  min_rating numeric DEFAULT 0,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
```

Seed default ranks:
| Rank | Consultations | Earnings | Months | Rating | Icon |
|------|--------------|----------|--------|--------|------|
| Nuevo | 0 | 0 | 0 | 0 | shield |
| Activo | 10 | 500 | 1 | 3.5 | zap |
| Destacado | 30 | 2000 | 3 | 4.0 | award |
| Experto | 75 | 5000 | 6 | 4.5 | star |
| Élite | 150 | 15000 | 12 | 4.8 | crown |

Add `rank_override uuid REFERENCES doctor_ranks(id)` to `doctor_profiles` (replaces `badge_override`).

Create a `get_doctor_rank` SQL function that takes doctor stats and returns the highest matching rank (or the override if set).

Update `doctor_profiles_public` view to include `rank_override`.

RLS: admins can update `doctor_ranks`, all authenticated can read.

### Admin UI (`AdminDoctors.tsx`)
- Replace the current Pro/New/Auto badge dropdown with a rank selector showing all available ranks from `doctor_ranks`
- Add a new admin page `AdminRanks.tsx` accessible from admin sidebar for managing ranks (CRUD on thresholds, names, colors)

### Frontend Components
- Refactor `DoctorBadge.tsx` → support the new rank system with dynamic icon, color, and label from the `doctor_ranks` table
- Create a `useDoctorRanks` hook that fetches ranks once and caches them
- Update `Doctors.tsx` doctor cards to show the new rank badge
- Update `DoctorProfile.tsx` to show the rank prominently

### Files to modify
- Migration SQL (new table + seed + alter doctor_profiles)
- `src/components/doctor/DoctorBadge.tsx` — refactor for dynamic ranks
- `src/hooks/useDoctorRanks.ts` — new hook
- `src/pages/AdminDoctors.tsx` — rank selector
- `src/pages/Doctors.tsx` — use new badge
- `src/pages/AdminRanks.tsx` — new admin page for rank management
- `src/App.tsx` — add route for AdminRanks

## 4. Video Thumbnail Fix (`ContentGallery.tsx`)

**Root cause**: Line 299 filters `!c.file_url.startsWith('http')` which excludes Cloudflare-hosted videos (their `file_url` starts with `https://`). These videos never get thumbnails generated.

**Fix**: Remove the `!c.file_url.startsWith('http')` filter. Instead:
- For videos with `file_url` starting with `http` (Cloudflare), pass the URL directly to `generateVideoThumbnail()`
- For videos with storage paths, get a signed URL first then generate thumbnail
- Also handle the case where `generateVideoThumbnail` fails due to CORS on Cloudflare URLs — add `crossOrigin = 'anonymous'` (already set) but also try without it as fallback

Updated logic:
```
const needThumb = mapped.filter(c => !c.thumbnail_url && c.type === 'video');
// + images/pdfs from storage that need signed URLs
const needSignedUrl = mapped.filter(c => !c.thumbnail_url && c.type !== 'video' && !c.file_url.startsWith('http'));
```

For each video without thumbnail:
1. If `file_url` starts with `http` → use directly for `generateVideoThumbnail()`
2. Else → get signed URL first, then generate thumbnail

