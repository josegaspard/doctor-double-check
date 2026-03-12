

# Plan: Drag & Drop, Content Protection, Live Thumbnails, Share Modal, Self-Profile Actions, City Filter, Paid Chat, Specialty & PPT Support

This is a large set of features. Here's the breakdown:

---

## 1. Drag & Drop for File Uploads

**Files:** `src/pages/DoctorUpload.tsx`, `src/components/live/LiveSetupForm.tsx`

- Add `onDragOver`, `onDragLeave`, `onDrop` handlers to the file upload zones
- Visual feedback: border color change + "Suelta tu archivo aquí" text on drag
- On drop, extract the file from `e.dataTransfer.files[0]` and set it as `selectedFile`
- Apply to both the content upload page and the new thumbnail upload in LiveSetupForm

---

## 2. Block Right-Click Download on Content Preview

**File:** `src/components/content/ContentPreviewModal.tsx`

- Remove the "Abrir en pestaña" button from the PDF fallback (lines 150-160) — this exposes the signed URL
- Remove the "Abrir en pestaña" button from the error state as well
- Add `onContextMenu={e => e.preventDefault()}` to the entire `DialogContent` wrapper
- Add keyboard shortcut blocker (`Ctrl+S`, `Ctrl+P`, `Ctrl+Shift+I`) inside the modal when open

---

## 3. Thumbnail Image Upload for Recordings (in Go Live Setup)

**Files:** `src/components/live/LiveSetupForm.tsx`, `src/pages/DoctorGoLive.tsx`

- Add a new Section 5 in LiveSetupForm: "Portada de grabación" with an image upload field
- Accept only image files (`accept="image/*"`)
- Add `thumbnailFile` to `LiveConfig` interface
- In `DoctorGoLive.tsx`, after creating the live, upload the thumbnail to `thumbnails` bucket and update the `lives` row with the `thumbnail_url`
- This thumbnail will propagate to recordings via the existing `fetchRecordings` logic in `LivesContext` which already falls back to `lives.thumbnail_url`

---

## 4. Share Modal with Social Options

**File:** `src/pages/LivePlayer.tsx`

- Replace the current `navigator.share` / clipboard fallback with a custom share modal/popover
- Show buttons for: WhatsApp, Facebook, X (Twitter), Copy Link
- Each button builds the appropriate share URL:
  - WhatsApp: `https://wa.me/?text=...`
  - Facebook: `https://www.facebook.com/sharer/sharer.php?u=...`
  - X: `https://twitter.com/intent/tweet?url=...&text=...`
  - Copy: clipboard copy
- Include live title, doctor name, and the URL as share content
- Use a `Dialog` or `Popover` component

---

## 5. Hide Self-Actions on Doctor Profile

**File:** `src/pages/DoctorProfile.tsx`

- Add a check: `const isSelf = user?.id === doctor?.id`
- Wrap the CTA buttons section (Orientación, Subscribe, Ver Lives, Bloquear) in `{!isSelf && ...}` so doctors viewing their own profile don't see these actions
- Keep "How it works" visible for everyone

---

## 6. City Filter on Lives Grid

**Files:** DB migration, `src/contexts/LivesContext.tsx`, `src/pages/LivesGrid.tsx`

- **DB Migration:** Add `location TEXT` column to `lives` table (nullable, populated from `doctor_profiles.location` at creation time)
- **LivesContext:** When creating a live, fetch doctor's location and store it. Add `location` to the `Live` interface
- **LivesGrid:** Extract unique locations from active lives, add a third row of filter chips for cities

---

## 7. Paid Chat in Lives (Highlighted Comments)

**Files:** DB migration, `src/components/live/LiveChat.tsx`, `src/components/live/LiveSetupForm.tsx`, `src/pages/DoctorGoLive.tsx`

- **DB Migration:** Add `is_paid BOOLEAN DEFAULT false` and `highlight_until TIMESTAMPTZ` columns to `live_chat_messages` table. Add `chat_mode TEXT DEFAULT 'free'` to `lives` table (values: 'free', 'paid_only', 'mixed')
- **LiveSetupForm:** Add a new option under chat settings: "Chat mode" with radio buttons (Free / Paid only / Mixed). Add price field for paid messages
- **LiveConfig:** Add `chatMode` and `chatPrice` fields
- **LiveChat:** When `chatMode` is 'paid_only', show a pay-to-comment prompt. When 'mixed', show option to highlight. Highlighted messages get a distinct background color (using `bg-primary/10` or `bg-amber-50`) and stay pinned/highlighted for a configured duration
- Payment uses existing wallet `process_wallet_purchase` RPC

---

## 8. Add "Cirugía General" to All Specialty Lists

**Files:** `src/components/live/LiveSetupForm.tsx`, `src/pages/Doctors.tsx`

- Add 'Cirugía General' to the `SPECIALTIES` array in `LiveSetupForm.tsx` (it's missing there)
- Add it to `Doctors.tsx` SPECIALTIES array
- Already present in `Onboarding.tsx`, `ClinicalSessions.tsx`, and seed data

---

## 9. PowerPoint/Presentation Support in Content Library

**Files:** DB migration, `src/pages/DoctorUpload.tsx`, `src/components/content/ContentPreviewModal.tsx`

- **DB Migration:** Add `'presentation'` to the `content_type` enum: `ALTER TYPE content_type ADD VALUE 'presentation'`
- **DoctorUpload:** Update file input `accept` to include `.pptx,.ppt,.key` and the `getFileType` function to detect presentation files
- **ContentPreviewModal:** Add a presentation case that shows a download-protected view (since browsers can't natively render PPTX). Display file info with icon, title, and metadata. No download button
- Add a presentation icon config to `typeConfig`

---

## Summary of DB Migrations Needed

1. `ALTER TABLE lives ADD COLUMN location TEXT`
2. `ALTER TABLE lives ADD COLUMN chat_mode TEXT DEFAULT 'free'`  
3. `ALTER TABLE lives ADD COLUMN chat_price NUMERIC DEFAULT 0`
4. `ALTER TABLE live_chat_messages ADD COLUMN is_paid BOOLEAN DEFAULT false`
5. `ALTER TABLE live_chat_messages ADD COLUMN highlight_until TIMESTAMPTZ`
6. `ALTER TYPE content_type ADD VALUE 'presentation'`

## Files to Modify

1. `src/pages/DoctorUpload.tsx` — drag & drop + PPT support
2. `src/components/live/LiveSetupForm.tsx` — thumbnail upload, chat mode, Cirugía General
3. `src/pages/DoctorGoLive.tsx` — handle thumbnail upload, location, chat mode
4. `src/components/content/ContentPreviewModal.tsx` — block downloads, PPT preview
5. `src/pages/LivePlayer.tsx` — share modal with social buttons
6. `src/pages/DoctorProfile.tsx` — hide self-actions
7. `src/pages/LivesGrid.tsx` — city filter chips
8. `src/contexts/LivesContext.tsx` — location field in Live interface
9. `src/components/live/LiveChat.tsx` — paid/highlighted messages
10. `src/pages/Doctors.tsx` — add Cirugía General

