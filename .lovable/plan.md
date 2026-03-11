

# Plan: Fix Doctor Profile Layout & Improve Payment Section Clarity

## Issues from Screenshots

1. **Location stat card** — Missing vertical centering. The other two stat cards have icon + number + label (3 elements), but the location card only has icon + text (2 elements), so it's not vertically centered relative to siblings.

2. **CTA buttons layout** — The secondary buttons (Subscribe/Premium, Ver Lives) are in a carousel-like horizontal scroll with arrows, which looks broken. They should be a clean grid without carousel arrows. The "Bloquear" button is loose underneath.

3. **Payment section wording** — Still confusing. Needs to clearly explain it's for managing active subscriptions/memberships like Lovable or Netflix do.

## Changes

### 1. `src/pages/DoctorProfile.tsx` — Fix stat cards + button layout

**Location stat card (lines 500-513):** Add `flex flex-col items-center justify-center` to ensure vertical centering matches sibling cards. Add a label below ("Ubicación") for consistency.

**CTA buttons (lines 584-618):** Restructure:
- Primary CTA: full-width, `size="lg"` (keep as-is)
- Secondary row: `grid grid-cols-2 gap-2` with proper sizing — no carousel, just clean buttons
- Block button: smaller, ghost variant, centered below

### 2. `src/lib/i18n/es.ts` + `en.ts` — Improve payment section text

- `managePayments`: "Membresías y Pagos" / "Memberships & Payments"
- `managePaymentsDescription`: "Administra tus membresías activas, cancela renovaciones o actualiza tu método de pago" / "Manage your active memberships, cancel renewals, or update your payment method"
- `openPaymentPortal`: "Administrar mis membresías" / "Manage my memberships"
- `paymentPortalNote`: "Solo disponible si tienes una membresía o compra activa." / "Only available if you have an active membership or purchase."

## Files
1. `src/pages/DoctorProfile.tsx`
2. `src/lib/i18n/es.ts`
3. `src/lib/i18n/en.ts`

