

# Comprehensive UX & Data Improvements

## 1. SEO & Favicon Fix

**Files: `index.html`, `public/favicon.png`, `public/icon-192.png`, `public/icon-512.png`, `public/manifest.json`**

- Generate a square version of the official teal "M" logo from `src/assets/logo-medical-masters.png` (crop the left "M" symbol) and overwrite all three icons (`favicon.png` 256×256, `icon-192.png`, `icon-512.png`).
- Update `index.html` to add cache-busting (`?v=2`) on the favicon link so browsers/Google re-fetch the new icon.
- Optimize SEO metadata:
  - **Title**: `Medical Masters · Orientación médica con especialistas verificados`
  - **Description**: `Plataforma médica profesional en México: orientaciones en línea, lives con doctores certificados, contenido premium y expediente clínico digital. 100% verificados ante SEP y COFEPRIS.`
  - Add Spanish-friendly OG/Twitter copy and keywords.

## 2. Cédula + COFEPRIS on Live Cards

**Files: `src/pages/LivesGrid.tsx`, SQL migration**

- Add a new badge row inside `LiveCard` (right after the specialty Badge) showing the doctor's `cedula_profesional` and `cofepris_permit` with small icons (`ShieldCheck`).
- The `LivesContext` already loads `doctorId`; extend the live data fetch to also bring `cedula_profesional` and `cofepris_permit` from `doctor_profiles`.
- **Database**:
  - Add `cofepris_permit text` column to `doctor_profiles` (does not exist yet).
  - Backfill **test** values for ALL existing `doctor_profiles`: `cedula_profesional = 'CED-' || left(user_id::text, 8)` (where null) and `cofepris_permit = 'COF-' || left(user_id::text, 8)`. Clearly test-only fakes.

## 3. Live Setup: Always-on Free Chat + File Sharing for Both

**File: `src/components/live/LiveSetupForm.tsx`, `src/components/chat/ChatMessagesPanel.tsx`**

- Remove the 3 "ChatModeCard" choices (`free`/`mixed`/`paid_only`). The chat is **always free** for everyone. Hard-code `chatMode = 'free'` and remove the price input + advanced highlight options.
- Keep the master "Permitir preguntas" switch.
- For file sharing: keep `ChatFileUpload` available for **both** doctor and patient sides (already works that way) — no removal here. (Item 7 below removes file upload from the regular Chat, not the live chat.)

## 4. Show Consultation Price on Doctor Cards (Patients Only)

**File: `src/pages/Doctors.tsx`**

- Replace the comment `{/* Price hidden per client request */}` (line 822) with a `<PriceDisplay amount={doctor.consultation_fee} />` block, but only when `role === 'patient'`. Other roles continue to see no price.
- Style: small badge in the top-right of the card header, e.g. `Desde $XXX MXN`.
- Update memory rule to reflect the new exception (patients see price; doctors/residents/visitors do not).

## 5. Conditional Frequency for Habits

**File: `src/pages/MedicalRecord.tsx` (Hábitos tab)**

- Replace the single frequency dropdown per habit with a two-step flow:
  1. **Yes/No** toggle (positivo/negativo).
  2. If **Yes**: reveal `Frecuencia` dropdown (current options) + a new `Cantidad` text field (e.g. "2 copas", "5 cigarros/día", "30 min × 4 días").
- Apply to all 6 habits: alcohol, smoking, vaping, hookah, drugs, exercise.
- **Database**: add columns `habit_<name>_amount text` for each of the 6 habits to store the quantity. Existing `habit_<name>` text column keeps frequency (`never` = No; anything else = Yes).
- Update fetch + save logic (lines ~262–356) to read/write the new amount fields.

## 6. Premium Content: All / Free / Purchased (Already Exists)

**File: `src/pages/ContentGallery.tsx`** — verify current state matches request.

- The page already has tabs: `Todo` / `Gratis` / `Comprados`. No code change needed beyond confirming both desktop sidebar and mobile dropdown expose the same three options consistently.

## 7. Chat: Add "Proveedores" filter + remove file upload

**Files: `src/pages/Chat.tsx`, `src/components/chat/ChatMessagesPanel.tsx`, `src/lib/i18n/{es,en}.ts`**

- Extend `chatFilter` type to `'all' | 'patients' | 'doctors' | 'providers'` and add a 4th filter button "Proveedores" (visible to all roles that can chat with vendors). Filter by `otherType === 'vendor'`.
- Remove `<ChatFileUpload>` from `ChatMessagesPanel` input row (and the `onFileUploaded` prop wiring in `Chat.tsx`). Files attribute survives in the type for backwards compatibility but the upload UI is gone.

## 8. Hospital Locator: Reorder Stat Chips + (No code change for Maps/Waze/Doctores)

**File: `src/pages/HospitalLocator.tsx`**

- Stat row order under the hero (line 323): change to `Hospitales · Información verificada · Ubicación activa · Doctores activos` (move "Doctores activos" right after "Ubicación activa").
- Add a new chip "X doctores activos" computed as `doctors.filter(d => isAvailableNow(d)).length` from a lightweight query against `doctor_profiles` (only counts, no list).
- Hospital cards already show Maps + Waze buttons; they already cover the request.

## 9. Doctor Vault Color Fix (yellow → blue)

**File: `src/pages/DoctorVault.tsx`**

- Page title: change "Vault de Pacientes" → "Mis Pacientes" (with `Users` icon).
- Replace the amber/yellow OTP warning banner (`bg-warning/10 border-warning/30 text-warning`) with the blue info palette (`bg-info/10 border-info/30 text-info`). Apply both to the top "Acceso Controlado" card and the per-patient "Requiere verificación OTP" pill.
- Add a contact-of-payments info row inside each patient card showing: name + email of payer, total paid amount, and number of items, queried from `purchases`/`consultations` joined to `auth.users` view. Read-only summary.

---

## Execution Order
1. Favicon + SEO meta (quick win, deploys instantly).
2. SQL migrations (cofepris column + habit amount columns + cedula/cofepris backfill).
3. Live card cédula/COFEPRIS badges.
4. LiveSetupForm simplification.
5. Doctor card price (patients only).
6. MedicalRecord conditional habits.
7. Chat proveedores filter + remove file upload.
8. Hospital locator chip reorder + doctor count.
9. DoctorVault color & title fix + payment summary.

## Files Modified (summary)
- `index.html` + 3 PNG regenerations (favicon/icon-192/icon-512)
- `src/pages/LivesGrid.tsx`, `src/contexts/LivesContext.tsx`
- `src/components/live/LiveSetupForm.tsx`
- `src/components/chat/ChatMessagesPanel.tsx`, `src/pages/Chat.tsx`
- `src/pages/Doctors.tsx`
- `src/pages/MedicalRecord.tsx`
- `src/pages/HospitalLocator.tsx`
- `src/pages/DoctorVault.tsx`
- `src/lib/i18n/{es,en}.ts` (new strings: cédula, COFEPRIS, proveedores, mis pacientes, etc.)
- 2 SQL migrations (1 schema, 1 data backfill)

