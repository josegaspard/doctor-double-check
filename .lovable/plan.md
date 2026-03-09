

# Plan: Wallet UX Overhaul + Doctor Cards Redesign + Responsive Ad Banners

## 1. Wallet UX/UI Overhaul (`src/pages/Wallet.tsx`)

**Current issues**: The wallet page is functional but lacks onboarding guidance and mobile polish. Users don't understand what the wallet is for or how to use it across the platform.

**Changes**:
- Redesign the hero section: move balance to a prominent full-width card with a subtle gradient background, larger typography, and a "How it works" stepper (3 steps: Recharge → Use Balance → Track Spending)
- Add a "Where can I use my wallet?" expandable section with icons linking to: Recordings, Content, Consultations, DoubleCheck — each with a one-liner explaining wallet usage
- On mobile: stack balance + top-up vertically with larger touch targets (44px buttons), top-up amounts as a horizontal scroll strip instead of 2x2 grid
- Add an empty-state illustration when balance is 0 with a clear CTA: "Start by adding funds"
- Translate all remaining hardcoded strings in `TransactionHistory.tsx` and `UserBankAccountForm.tsx` (e.g., "Solicitar reembolso", "Cuenta Bancaria", "Registrada", etc.)

## 2. Wallet CTAs in Payment Contexts

Add a small inline banner/tip in pages where wallet can be used, reminding users they can pay with their balance:

- **`RecordingPlayer.tsx`** (line 191): Change "Recargar Wallet" to use i18n, add wallet balance display
- **`PaywallModal.tsx`**: Show current wallet balance and "Pay with wallet" as primary option
- **`LiveConsultationBooking.tsx`**: Show balance in the payment section
- **`DoubleCheckFlow.tsx`**: Show balance reminder

These are small text additions, not full rewrites — just adding a `💰 Your balance: $X` line near payment buttons.

## 3. Doctor Cards Visual Redesign (`src/pages/Doctors.tsx`)

**Current issue**: All doctor cards look identical — same layout, same info density. Users can't differentiate at a glance.

**Changes**:
- Redesign cards with a visual hierarchy that makes each doctor feel distinct:
  - Add a colored accent strip at the top of each card based on specialty (e.g., Cardiology = red, Pediatrics = blue)
  - Show the consultation fee prominently as a price tag badge in the corner
  - Make the availability indicator larger and more prominent (green dot → green pill with text)
  - Show a short bio snippet (2 lines) on ALL devices (not just desktop)
  - Add a subtle background pattern or gradient to the avatar area
  - For doctors who are "available now", add a subtle green border glow
- Improve filter chips: add emoji/icons to specialty chips for visual scanning (e.g., 🫀 Cardiología, 🧠 Neurología)
- Mobile: cards should be full-width with more generous padding and clearer visual separation

## 4. Responsive Ad Banners (`src/components/ads/AdBanner.tsx`)

**Current issue**: Banners use `w-full h-auto` which works for images but doesn't constrain aspect ratio. On very wide screens the banner stretches; on mobile it may be too short.

**Changes**:
- Add aspect ratio constraints using Tailwind: `aspect-[4/1]` on desktop, `aspect-[3/1]` on tablet, `aspect-[2/1]` on mobile
- Use `object-cover` with `max-h-[200px] sm:max-h-[250px] lg:max-h-[300px]` to prevent oversized banners
- For video banners, apply same responsive constraints
- Add container query approach: the banner fills its container width but maintains proportion
- Where `AdBanner` is used (`LivesGrid`, `RecordingsGrid`, `ContentGallery`), ensure the parent container has proper padding/margins for mobile

## Files to Modify

1. **`src/pages/Wallet.tsx`** — Redesign layout with stepper, "where to use" section, mobile-first top-up strip, empty state
2. **`src/components/wallet/TransactionHistory.tsx`** — Translate remaining hardcoded strings
3. **`src/components/wallet/UserBankAccountForm.tsx`** — Translate all hardcoded strings
4. **`src/pages/Doctors.tsx`** — Visual card redesign with specialty colors, fee badge, enhanced availability, bio on mobile
5. **`src/components/ads/AdBanner.tsx`** — Responsive aspect ratios and max-height constraints
6. **`src/lib/i18n/es.ts`** + **`src/lib/i18n/en.ts`** — Add missing wallet/bank/refund/doctor i18n keys
7. **`src/pages/RecordingPlayer.tsx`** — Add wallet balance display near payment
8. **`src/components/PaywallModal.tsx`** — Show wallet balance

