

# Plan: Bulk Delete Recordings, Mobile Live Fullscreen, and Fix Report System

## 1. Bulk Delete Recordings

Add multi-select mode to the "Mis Grabaciones" page so doctors can select multiple recordings and delete them all at once. Complete cleanup includes storage files, database records, and associated `doctor_content` entries.

### Changes to `src/pages/DoctorRecordings.tsx`:
- Add state for `selectionMode`, `selectedIds` (Set of recording IDs)
- Add a "Seleccionar" toggle button in the card header next to "Grabaciones"
- When selection mode is active:
  - Show checkboxes on each recording card/row
  - Show a floating action bar at the bottom with count + "Eliminar seleccionados" button
  - Disable normal navigation/dropdown on tap (clicking selects instead)
  - Add "Seleccionar todos" / "Deseleccionar todos" options
- On bulk delete confirmation (AlertDialog):
  - Delete storage files for all selected recordings
  - Delete associated `doctor_content` entries that reference the video URLs
  - Delete all selected recording rows from DB
  - Update local state immediately
- Follow the existing bulk-delete pattern used in chat sessions (banner + floating bar + AlertDialog confirmation)

## 2. Mobile Live Stream Fullscreen Fix

The screenshot shows the video only takes up the top portion of the screen with a large black gap below. The `DailyVideoPlayer` video element needs to fill the entire screen.

### Changes to `src/components/live/DailyVideoPlayer.tsx`:
- Ensure the video element uses `object-cover` and `w-full h-full` to fill its container completely on mobile
- The container in `LiveStreamView` already uses `fixed inset-0` and `flex-1`, so the player itself needs to expand properly

### Changes to `src/components/live/LiveStreamView.tsx`:
- The mobile layout already has `fixed inset-0 z-50 bg-black flex flex-col` with `height: 100dvh`
- Ensure the video container `flex-1 relative` has `overflow-hidden` and the video inside fills it
- The DailyVideoPlayer's internal video element should use `object-cover` on mobile to fill the viewport without black bars

### Changes to `src/pages/DoctorGoLive.tsx`:
- The mobile detection currently uses `window.innerWidth < 768` which doesn't update on orientation change. Use `useIsMobile()` hook instead for consistency.

## 3. Fix Report Submission Error + Enhance Admin Reports Panel

### Root cause of error
The `reports` table has a CHECK constraint: `content_type IN ('live', 'recording', 'doctor', 'chat_message')`. The `ReportIssue.tsx` page tries to insert `content_type: 'platform_report'`, which violates this constraint and causes the insert to fail.

### Database migration
- ALTER the CHECK constraint on `reports.content_type` to add `'platform_report'` as an allowed value
- Add columns to `reports` table:
  - `attachment_urls text[]` -- for uploaded images/videos
  - `subject text` -- for the report subject line
  - `contact_email text` -- for contact email

### Changes to `src/pages/ReportIssue.tsx`:
- Store subject and contact_email in their own columns instead of concatenating into description
- Add file upload capability (images/videos) using the existing `doctor-content` or a new `report-attachments` storage bucket
- Upload attachments before submitting the report
- Save attachment URLs in the `attachment_urls` column

### Changes to `src/pages/AdminReports.tsx`:
- Add `'platform_report'` to `CONTENT_TYPE_LABELS` mapping
- Display the new fields (subject, contact_email, attachments) in the review dialog
- Show attachment previews (images/videos) in the report detail view
- Add admin response functionality:
  - Add a "Responder al usuario" textarea
  - On save, create a notification to the reporter with the admin's response
- Improve mobile layout with responsive card design

### Storage migration
- Create a `report-attachments` bucket (private)
- Add RLS policies: authenticated users can upload to their own folder, admins can read all

## Summary of changes

| File / Resource | Change |
|---|---|
| Database migration | Add `platform_report` to content_type CHECK, add `attachment_urls`, `subject`, `contact_email` columns, create `report-attachments` bucket |
| `src/pages/DoctorRecordings.tsx` | Add multi-select mode with bulk delete functionality |
| `src/components/live/DailyVideoPlayer.tsx` | Ensure video fills container on mobile with `object-cover` |
| `src/components/live/LiveStreamView.tsx` | Fix video container to fill entire mobile viewport |
| `src/pages/DoctorGoLive.tsx` | Use `useIsMobile()` hook instead of `window.innerWidth` |
| `src/pages/ReportIssue.tsx` | Fix content_type, add file upload, use new DB columns |
| `src/pages/AdminReports.tsx` | Show new fields, attachment previews, admin response with notification |

