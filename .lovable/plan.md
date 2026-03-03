

# Plan: Rename "Double Check" to "Medical Masters", Mobile UX Optimization, Admin SEP Verification, and OTP Provider

This is a very large scope request. I'll break it into **4 phases** to keep each change manageable and testable.

---

## Phase 1: Rename "Double Check" / "Doble Check" to "Segunda Opinión" (by Medical Masters)

All UI-facing references to "Double Check" or "Doble Check" will be renamed to **"Segunda Opinión"** (which is the actual medical term for the feature). Internal code variables like `isDoubleCheck`, `is_double_check` (database columns) stay unchanged to avoid breaking the schema.

**Files to modify (21 files with text changes):**
- `src/lib/i18n/es.ts` -- Change `doubleCheck: 'Double Check'` to `'Segunda Opinión'`, and `welcomeSubtitle` from `'¡Bienvenido a Dr Double Check!'` to `'¡Bienvenido a Medical Masters!'`
- `src/lib/i18n/en.ts` -- Same keys: `doubleCheck: 'Second Opinion'`, `welcomeSubtitle: 'Welcome to Medical Masters!'`
- `src/pages/DoubleCheck.tsx` -- Update all UI strings from "Double Check" to "Segunda Opinión"
- `src/components/doublecheck/DoubleCheckFlow.tsx` -- UI strings
- `src/components/chat/ChatSessionItem.tsx` -- Badge text
- `src/components/chat/ChatHeader.tsx` -- Badge text
- `src/hooks/auth/useAuthState.ts` -- Rename `drDoubleCheck_visitor` to `medicalMasters_visitor`
- `src/hooks/auth/useAuthActions.ts` -- Same session storage key rename
- `supabase/functions/notify-new-chat/index.ts` -- Notification text

---

## Phase 2: Full Mobile UX/UI Optimization (ALL pages)

Comprehensive mobile-first optimization across all internal pages. Key changes:

**Onboarding (`src/pages/Onboarding.tsx`):**
- Reduce padding on mobile (`px-3 py-4` instead of `px-4 py-8`)
- Make card max-width responsive (`max-w-lg` on desktop, full width on mobile)
- Reduce step indicator circle sizes on mobile
- Make role selection cards more compact with smaller icons
- Ensure DocumentSignature is fully visible without scrolling
- Add `safe-area-inset` padding for notched devices

**Layout (`src/components/layout/MainLayout.tsx`):**
- Verify bottom nav has proper spacing for all screen sizes
- Ensure "Más" menu items are touch-friendly (min 44px tap targets)

**All internal pages (batch optimization):**
- `DoctorDashboard.tsx` -- Responsive grid, smaller cards on mobile
- `Chat.tsx` -- Full-height chat on mobile, keyboard-aware
- `Wallet.tsx` -- Stack transaction cards vertically
- `Settings.tsx` -- Simplified mobile layout
- `Doctors.tsx` -- Single column cards on mobile
- `LivesGrid.tsx` / `RecordingsGrid.tsx` -- Responsive grid cols
- `ContentGallery.tsx` -- Mobile-friendly gallery
- `AdminDoctors.tsx` -- Stackable filter buttons, card layout
- `Notifications.tsx` -- Full-width notification items
- All other pages -- Consistent `container mx-auto px-3 sm:px-4` padding

**Global CSS (`src/index.css`):**
- Add safe area inset variables
- Ensure minimum tap target sizes (44px)
- Optimize font sizes for readability on small screens

---

## Phase 3: Admin SEP Verification API + Manual Verification

**Admin can verify cédula directly from the doctor management panel:**

**File: `src/pages/AdminDoctors.tsx`:**
- Add a "Verificar Cédula" button next to each pending doctor card
- When clicked, calls `verify-cedula-sep` edge function with the doctor's license number
- Shows results inline (nombre, titulo, institucion from SEP)
- Admin can then approve/reject with full context
- If SEP is unavailable, show a link to `cedulaprofesional.sep.gob.mx` for manual verification
- Add a "Verificación Manual" toggle that lets admin mark as verified without API

**No new edge function needed** -- the existing `verify-cedula-sep` already uses the free SEP Solr API.

---

## Phase 4: OTP Provider Recommendation + Configuration

The existing `send-otp-email` edge function already supports **Vonage (Nexmo)** and **Telnyx**. Both are pre-integrated in code.

**Recommendation: Vonage (Nexmo)**
- Free trial credits ($2 USD, enough for ~100 SMS)
- Already coded in `sendSmsVonage()` function
- Setup: Sign up at vonage.com, get API Key + API Secret from dashboard

**What needs to happen:**
1. User signs up at Vonage and gets credentials
2. We configure 2 secrets: `SMS_API_KEY` and `SMS_API_SECRET`
3. Optionally set `SMS_PROVIDER=vonage` and `SMS_FROM=MedMasters` (already defaults)
4. The OTP flow is already fully built -- no code changes needed

---

## Summary of Missing Processes/Sections

After reviewing the full codebase, here are processes that may need attention:

1. **Payment flow for consultations** -- Already built (Stripe + Wallet), functional
2. **Subscription payments** -- Already built (Stripe checkout)
3. **Payout to doctors** -- Built (admin triggers payouts)
4. **Video call billing** -- Built (Daily.co integration)
5. **Refund process** -- Built (admin refund panel)
6. **Email verification on signup** -- Configured (not auto-confirm)
7. **Missing**: No SMS OTP is active yet (needs Vonage secrets)
8. **Missing**: Admin cannot currently trigger SEP verification from the panel (Phase 3 adds this)

---

## Implementation Order

1. **Phase 1** (Rename) -- Quick text replacements across 9+ files
2. **Phase 2** (Mobile UX) -- CSS/layout changes across ~15 pages
3. **Phase 3** (Admin SEP button) -- AdminDoctors.tsx enhancement
4. **Phase 4** (OTP) -- Secret configuration only, no code changes

Total estimated scope: ~20 files modified.

