

# Plan: Full Mobile Optimization and UX/UI Polish

## Overview
Systematic pass through every page to fix overflow issues, ensure minimum touch targets (44x44px), apply responsive typography, and guarantee nothing breaks screen width on mobile. Also includes UX clarity improvements.

---

## 1. Global CSS Fixes (`src/index.css`)
- Add `overflow-wrap: anywhere` to body to prevent long text from breaking layouts
- Add utility class `.mobile-container` with `px-3` and `max-w-full overflow-x-hidden`
- Ensure all buttons have minimum `h-10` (40px) touch target via base layer override
- Add `.btn-mobile-full` utility: buttons that go `w-full` on mobile, `w-auto` on `sm:`

## 2. MainLayout (`src/components/layout/MainLayout.tsx`)
- Add `overflow-x-hidden` to the root `div` to prevent any horizontal scroll globally
- Ensure header actions don't overflow: wrap right-side icons in a flex container with `gap-1 flex-shrink-0`

## 3. Page-by-Page Fixes

### 3.1 Prescriptions (`src/pages/Prescriptions.tsx`)
**Issues**: Header `flex items-center justify-between gap-4` can overflow on mobile when title + button are too wide
- Change header layout: stack vertically on mobile (`flex-col sm:flex-row`)
- Make "Nueva Receta" button full-width on mobile
- Reduce icon+title combo to single line on mobile (smaller text)

### 3.2 MedicalHistory (`src/pages/MedicalHistory.tsx`)
**Issues**: Header with title + export button overflows; `lg:grid-cols-2` starts too late
- Stack header vertically on mobile: title on top, export button below (full width)
- Change grid to `md:grid-cols-2` instead of `lg:grid-cols-2`
- Add `px-3` on mobile
- Reduce file drop zone padding on mobile

### 3.3 RecordingsGrid (`src/pages/RecordingsGrid.tsx`)
**Issues**: `px-4` without `sm:` prefix; tabs + filters row can overflow; wallet button text overflow
- Change to `px-3 sm:px-4`
- Make TabsList horizontally scrollable with `overflow-x-auto` on mobile
- Truncate wallet balance text on mobile
- Stack header vertically on mobile

### 3.4 DoctorEarnings (`src/pages/DoctorEarnings.tsx`)
**Issues**: Summary cards grid `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` - on mobile, text is fine but the charts section uses fixed heights that look cramped
- Change summary grid to `grid-cols-2 md:grid-cols-4` (2 cols even on mobile for compact stats)
- Reduce card padding on mobile
- Make chart `ResponsiveContainer` height responsive: `h-[200px] sm:h-[250px]`
- Transaction history table: ensure description column truncates properly
- Export CSV button: icon-only on mobile

### 3.5 DoctorProfile (`src/pages/DoctorProfile.tsx`)
**Issues**: Action buttons (`flex-wrap gap-3`) can overflow width; Live banner button overflows; stats grid on mobile
- Change action buttons: full-width stacked on mobile, wrap on desktop
- `flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-3` for the action buttons section
- Make SubscribeButton and consultation button `w-full sm:w-auto`
- Live banner: stack content vertically on small screens
- "How it works" grid: single column on mobile (already has `sm:grid-cols-3`)

### 3.6 Doctors (`src/pages/Doctors.tsx`)
**Issues**: Mostly good, but card footer can overflow when Pro badge + buttons are present
- Ensure card footer wraps properly: add `flex-wrap` to footer container
- Pagination buttons: reduce text on mobile ("Ant." / "Sig." instead of "Anterior" / "Siguiente")

### 3.7 Settings (`src/pages/Settings.tsx`)
**Issues**: Identity verification row (`flex items-center justify-between`) overflows on mobile when avatar + name + button are too wide
- Stack verification section vertically on mobile
- Make "Start Verification" button full-width on mobile
- Switch labels: ensure text wraps properly with `flex-1 min-w-0`

### 3.8 Wallet (`src/pages/Wallet.tsx`)
- Mostly good already. Just ensure top-up amount buttons don't overflow on very small screens
- Add `text-xs` to button labels on mobile

### 3.9 Vault (`src/pages/Vault.tsx`)
- Storage card: ensure the "Ver planes" button doesn't overflow
- Upload section: stack category + description inputs vertically on smallest screens
- Permission dialog: ensure doctor cards don't overflow

### 3.10 LivePlayer (`src/pages/LivePlayer.tsx`)
- Chat height: increase mobile height from `h-[280px]` to `h-[300px]`
- Sidebar doctor card: reduce avatar size on mobile
- Action buttons: ensure they wrap without overflow

### 3.11 DoctorGoLive / LiveSetupForm
- Ensure form inputs are full-width
- Tags and price inputs should stack on mobile

### 3.12 Notifications (`src/pages/Notifications.tsx`)
- Increase touch target for action buttons (already `h-10 w-10`, good)
- Ensure notification card text doesn't overflow

### 3.13 DoctorDashboard (`src/pages/DoctorDashboard.tsx`)
- Already has responsive classes, verify quick actions grid doesn't overflow
- Ensure tab triggers fit on mobile (already `grid-cols-2`, good)

### 3.14 Chat (`src/pages/Chat.tsx`)
- Already fixed in last edit, verify no regressions

### 3.15 VideoCall (`src/pages/VideoCall.tsx`)
- Already optimized, just verify PiP video doesn't overlap with controls

### 3.16 UserProfile (`src/pages/UserProfile.tsx`)
- Ensure edit name input + save button wrap properly on very small screens
- Make buttons full width on mobile where they appear inline

## 4. Global UX Improvements

### 4.1 Button touch feedback
Add `active:scale-[0.97] transition-transform` to the base Button component via a small CSS class, so every button across the app gives tactile feedback.

### 4.2 Card interactions
Add `touch-action: manipulation` to interactive cards to prevent double-tap zoom on mobile.

### 4.3 Toast positioning
Ensure toasts appear at the top on mobile (above the bottom nav) by configuring Sonner's position.

---

## Technical File Changes Summary

| File | Key Changes |
|------|-------------|
| `src/index.css` | Add overflow-wrap, touch-action utilities |
| `src/components/layout/MainLayout.tsx` | Add `overflow-x-hidden` to root |
| `src/pages/Prescriptions.tsx` | Stack header on mobile; full-width button |
| `src/pages/MedicalHistory.tsx` | Stack header; responsive grid breakpoint |
| `src/pages/RecordingsGrid.tsx` | Responsive padding; scrollable tabs; stacked header |
| `src/pages/DoctorEarnings.tsx` | 2-col summary grid on mobile; responsive chart height |
| `src/pages/DoctorProfile.tsx` | Full-width stacked action buttons on mobile |
| `src/pages/Doctors.tsx` | Flex-wrap card footer; shorter pagination labels |
| `src/pages/Settings.tsx` | Stack verification row on mobile |
| `src/pages/Vault.tsx` | Prevent overflow in storage card and upload form |
| `src/pages/LivePlayer.tsx` | Minor sizing adjustments for mobile sidebar |
| `src/pages/Notifications.tsx` | Minor touch target verification |
| `src/pages/UserProfile.tsx` | Responsive inline edit controls |
| `src/components/ui/sonner.tsx` | Position toasts at top on mobile |

**Implementation order**: Global CSS first, then MainLayout, then page-by-page alphabetically.

