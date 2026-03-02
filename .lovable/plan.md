
# Plan: Bulk Delete for Prescriptions, Availability & Content Library UX

## 1. Prescriptions - Bulk Delete

**File: `src/components/prescriptions/PrescriptionsList.tsx`**

Add a selection mode (same pattern used for chat/notifications bulk delete):
- A "Manage" button in the header toggles selection mode
- Each card gets a checkbox on the left
- A sticky action bar appears at top/bottom with "Select All" and "Delete Selected" buttons
- Doctors can delete their own prescriptions (RLS already allows `DELETE` for `doctor_id = auth.uid()`)
- Patients can NOT delete (RLS doesn't allow patient DELETE) -- so the manage button only appears for doctors
- If the prescription has a `file_url`, also delete the file from storage
- After deletion, update local state to remove deleted items

**File: `src/pages/Prescriptions.tsx`**
- Minor: pass a refresh callback or let PrescriptionsList manage its own state (already does)

## 2. Availability - Bulk Delete

**File: `src/hooks/useDoctorAvailability.ts`**
- Add a `deleteAvailability(id: string)` and `deleteAvailabilities(ids: string[])` function that calls `supabase.from('doctor_availability').delete().in('id', ids).eq('doctor_id', user.id)`
- RLS already has `Doctors can manage own availability` with ALL command, so DELETE is allowed

**File: `src/pages/DoctorAvailability.tsx`**
- Add selection mode toggle for the History section (past availabilities)
- Each history card gets a checkbox
- Sticky action bar with "Select All" / "Delete Selected"
- Also allow deleting individual upcoming availabilities via a trash icon
- Translate all hardcoded Spanish strings ("Historial", "Programado", "Confirmado", "Cancelado", "Completado", "Confirmar", "Cancelar", "Notificar", "Notificaciones enviadas", "Recordatorio automatico enviado", "Proximos", "No tienes disponibilidades programadas", "Duracion", "Programar", dialog labels, etc.)

## 3. Content Library - Better Management UX

**File: `src/pages/DoctorContentLibrary.tsx`**

Currently it's a grid of cards. Improvements:
- Add a "Manage" toggle button that switches to selection mode
- In selection mode: each card gets a checkbox overlay, "Select All" and "Delete Selected (N)" appear in a sticky bar
- Bulk delete: loop through selected IDs, delete DB records, then storage files
- The grid layout stays but with selection overlay
- This replaces the per-card trash icon when in manage mode
- Mobile: the sticky bar should be at the bottom with safe-area padding

## 4. Shared UX Pattern

All three sections follow the same UX pattern (already used in chat/notifications):
- Toggle button: "Manage" / "Done"
- Instructional banner: "Select items to delete"
- Checkboxes on each item
- Sticky action bar: "Select All (N)" | "Delete Selected (N)" in destructive red
- Confirmation dialog before bulk delete
- Toast on success

## Summary of Changes

| File | Change |
|------|--------|
| `src/components/prescriptions/PrescriptionsList.tsx` | Add selection mode, checkboxes, bulk delete logic with storage cleanup |
| `src/pages/Prescriptions.tsx` | Add "Manage" toggle button in header (doctors only) |
| `src/hooks/useDoctorAvailability.ts` | Add `deleteAvailabilities(ids)` function |
| `src/pages/DoctorAvailability.tsx` | Add selection mode for history, bulk delete, translate all Spanish strings |
| `src/pages/DoctorContentLibrary.tsx` | Add selection mode overlay, bulk delete, sticky bottom bar for mobile |
| `src/lib/i18n/en.ts` | Add keys for prescriptions, availability, and content management actions |
| `src/lib/i18n/es.ts` | Add matching Spanish keys |
