

# Plan: 4-Phase Implementation

This is a large scope spanning multiple features. Here is the plan organized by phase.

---

## Phase 1: Critical Fixes (Quick Wins)

### 1A. Remove "Lives Activos" from Doctor Dashboard
**File:** `src/components/doctor/DoctorStatsGrid.tsx`
- Remove the first stat item (`{ label: t('dashboard.activeLives'), value: activeLivesCount, icon: Radio, color: 'live' }`) from the `stats` array on line 45.
- Remove the `activeLivesCount` prop from the component interface and all call sites (`DoctorDashboard.tsx`).

### 1B. Remove "Pacientes" from Audience Selector
**File:** `src/components/content/AudienceSelector.tsx`
- Delete the entire `audience-patients` Label/RadioGroupItem block (lines 43-57).
- Keep the type `ContentAudience = 'all' | 'patients' | 'professionals' | 'subscribers'` for backward compatibility but remove the UI option.

### 1C. Block All Content Downloads
**File:** `src/components/content/ContentPreviewModal.tsx`
- Remove the "Descargar" button (lines 177-191) and the "Abrir en nueva pestaña" button (lines 169-176).
- Add `onContextMenu={(e) => e.preventDefault()}` to images and videos.
- For videos: add `controlsList="nodownload nofullscreen noremoteplayback"` (nodownload already present, add the rest).
- For images: wrap in a container with `pointer-events-none` on the image and a transparent overlay div to prevent right-click save.
- For PDFs: keep `#toolbar=0` and add `sandbox` attribute to iframe to block downloads.

### 1D. Fix OTP Floating Banner Colors
**File:** `src/components/vault/OtpFloatingBanner.tsx`
- Replace the generic `bg-warning/10 border-warning/30` with branded colors matching the site's primary palette (`bg-primary/10 border-primary/30 text-primary`).
- Update the urgent state to use `bg-destructive/10 border-destructive/30 text-destructive` (already correct).
- Update the timer countdown badge and icon colors to use `text-primary` instead of generic warning tones.

---

## Phase 2: Book Consultation from Live Stream

### 2A. Database Changes
- New table `live_consultation_requests`:
  - `id` (uuid PK), `live_id` (uuid FK → lives), `patient_id` (uuid FK → profiles), `doctor_id` (uuid FK → profiles), `message` (text, max 500 chars), `payment_method` ('wallet' | 'stripe'), `amount` (numeric), `chat_session_id` (uuid FK → chat_sessions), `status` ('pending' | 'completed' | 'cancelled'), `created_at`, `updated_at`
- RLS: patients can insert their own rows, doctors can read rows where they are `doctor_id`.
- Enable realtime on this table.

### 2B. New Component: `LiveConsultationBooking.tsx`
**File:** `src/components/live/LiveConsultationBooking.tsx`
- A dialog/sheet triggered by a "Reservar Orientación" button shown on the LivePlayer page (only for patients viewing another doctor's live).
- Contains:
  1. Doctor info summary (name, specialty, fee).
  2. A textarea for a message/comment (required, max 500 chars).
  3. Payment method selector (Wallet balance shown, or Stripe).
  4. "Pagar y Reservar" button.
- **Wallet flow**: Calls `process_consultation_purchase` RPC (already exists), then inserts the comment as the first message in the new chat session, inserts into `live_consultation_requests`, navigates to `/chat?session={id}`.
- **Stripe flow**: Calls `create-consultation-checkout` edge function with extra metadata (`live_id`, `message`), redirects to Stripe.
- After payment: The comment/message is sent as the first chat message automatically.
- Notification to doctor: Already handled by `process_consultation_purchase` RPC which inserts a notification. We'll enhance it to include "desde su live" context.

### 2C. Integrate into LivePlayer
**File:** `src/pages/LivePlayer.tsx`
- Add a prominent "Reservar Orientación - $X" button in the action bar (near like/share buttons), visible only to patients.
- Fetch the doctor's `consultation_fee` from `doctor_profiles` on mount.
- Open the `LiveConsultationBooking` dialog on click.

---

## Phase 3: Filters and UX Improvements

### 3A. Specialty/Tag Filter Bubbles in Lives Grid
**File:** `src/pages/LivesGrid.tsx`
- Add a horizontal scrollable row of specialty filter chips (bubbles) above the grid.
- Extract unique specialties from active lives + a few common ones.
- Add tag filter chips below specialties.
- Filter `activeLives` by selected specialty/tags.
- Mobile-optimized: horizontal scroll with `snap-x`, pill-shaped buttons.

### 3B. Improved Recordings Filters
**File:** `src/pages/RecordingsGrid.tsx`
- Replace the current `Tabs` + `Select` with a more visual approach:
  - Horizontal scrollable filter chips for: Todo, Gratis, De Pago, Comprados, Sin Comprar.
  - Specialty filter as scrollable chips instead of dropdown.
  - Add "free" tab: `rec.price === 0`, "paid" tab: `rec.price > 0`.
  - "Comprados": already `purchased`, "Sin Comprar": `!ownsRecording && price > 0`.
- Add clear visual badges on each card showing "Gratis", "Comprado ✓", or price.

### 3C. Chat Search Bar
**File:** `src/pages/Chat.tsx` and `src/components/chat/ChatSessionsList.tsx`
- Add a search input at the top of the chat sessions list.
- Filter sessions by: doctor/patient name, or search within message content.
- For message content search: query `chat_messages` table with `content.ilike('%term%')` and highlight matching sessions.
- Responsive: full-width on mobile, integrated into the sessions panel.

### 3D. Doctor Search UX Improvements
**File:** `src/pages/Doctors.tsx`
- Add horizontal scrollable specialty filter chips (bubbles) at the top, replacing or supplementing the current dropdown.
- Add city/location filter chips for common Mexican cities.
- Both filters should be visually prominent with active state highlighting.
- Mobile: chips scroll horizontally, search bar stays fixed at top.

### 3E. Wallet/Balance Guidance
- In pages where payment is required (DoctorProfile, RecordingsGrid, LivePlayer consultation booking), if user has no wallet or zero balance:
  - Show a clear CTA: "No tienes saldo. Recarga aquí →" linking to `/wallet`.
  - If not authenticated: "Regístrate para obtener saldo" linking to `/login`.

---

## Phase 4: Advanced Live Interaction

### 4A. Database Changes for Live Interaction Limits
- Add columns to `lives` table:
  - `max_questions` (integer, default null = unlimited)
  - `max_paid_chats` (integer, default null = unlimited)
  - `chat_enabled` (boolean, default true)
  - `questions_count` (integer, default 0)
  - `paid_chats_count` (integer, default 0)

### 4B. Live Setup Form Updates
**File:** `src/components/live/LiveSetupForm.tsx`
- Add toggle: "Permitir preguntas en el chat" (default on).
- Add number inputs: "Límite de preguntas" and "Límite de orientaciones pagadas" (optional).
- Pass these values when creating the live.

### 4C. Enforce Limits in LiveChat
**File:** `src/components/live/LiveChat.tsx`
- Before sending a message, check if `chat_enabled` is false → show "El doctor ha desactivado el chat".
- Check `questions_count >= max_questions` → show "Se alcanzó el límite de preguntas".
- Doctor toggle button in chat header to enable/disable chat in real-time (updates `lives.chat_enabled` via supabase).

### 4D. Enforce Paid Chat Limits
**File:** `src/components/live/LiveConsultationBooking.tsx`
- Before allowing booking, check `paid_chats_count >= max_paid_chats` → show "El doctor ha alcanzado el límite de orientaciones para este live".
- Increment counter after successful booking.

### 4E. Doctor-to-Doctor Live Interaction
- Doctors can already view lives (no role restriction on LivesGrid/LivePlayer).
- Add a special "Comentar como Médico" badge in LiveChat when the sender is a doctor.
- In LiveChat, fetch sender's role and display a "Dr." prefix or medical badge next to doctor names.
- Add a "Casos Clínicos" tag filter in the specialty bubbles to help doctors find relevant discussions.

---

## Technical Summary

**Files to create:**
- `src/components/live/LiveConsultationBooking.tsx`

**Files to modify:**
- `src/components/doctor/DoctorStatsGrid.tsx` — remove Lives Activos stat
- `src/pages/DoctorDashboard.tsx` — remove activeLivesCount prop
- `src/components/content/AudienceSelector.tsx` — remove Pacientes option
- `src/components/content/ContentPreviewModal.tsx` — remove download buttons, add protections
- `src/components/vault/OtpFloatingBanner.tsx` — fix colors
- `src/pages/LivePlayer.tsx` — add consultation booking button
- `src/pages/LivesGrid.tsx` — add filter chips
- `src/pages/RecordingsGrid.tsx` — improve filter UX
- `src/pages/Chat.tsx` — add search bar
- `src/components/chat/ChatSessionsList.tsx` — integrate search filtering
- `src/pages/Doctors.tsx` — add filter chips
- `src/components/live/LiveSetupForm.tsx` — add interaction limit settings
- `src/components/live/LiveChat.tsx` — enforce limits, doctor badges

**Database migrations:**
- Create `live_consultation_requests` table with RLS
- Add interaction limit columns to `lives` table

