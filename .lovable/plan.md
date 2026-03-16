

# Plan: UX/UI Audit Complete — PC, Tablet, Mobile

## Route & Link Audit

All 60+ routes in `App.tsx` map to lazy-loaded components with a `<NotFound />` catch-all. No orphan routes or 404 risks found. All pages use `MainLayout`. Footer links reference valid routes (`/terms`, `/privacy`, `/contact`, `/help`, `/security`, `/compliance`, `/for-doctors`, `/for-patients`, `/enterprise`, `/report-issue`).

## Issues Found & Fixes

### 1. DoctorStatsGrid — Mobile overflow on stats cards
**File:** `src/components/doctor/DoctorStatsGrid.tsx` (line 53)
- The `lg:grid-cols-6` creates very narrow cards on medium-large screens. Change to `lg:grid-cols-4` for better readability.
- The stats grid with 4 stat cards + 1 ConsultationFeeEditor = 5 items doesn't divide evenly into 6 columns.

### 2. DoctorQuickActions — Mobile card padding too tight
**File:** `src/components/doctor/DoctorQuickActions.tsx` (line 78)
- `p-3 sm:p-5` is fine but the button area (`mt-2 sm:mt-3`) can feel cramped on mobile. Increase min-height for touch targets.

### 3. MainLayout Desktop Nav — Text too small on medium screens
**File:** `src/components/layout/MainLayout.tsx` (line 369)
- Nav text is `text-[10px] lg:text-[11px] xl:text-xs` which is very hard to read on md screens. Bump to `text-[11px] lg:text-xs xl:text-sm` for better legibility.
- Padding `px-1 lg:px-1.5 xl:px-2` is cramped. Increase to `px-1.5 lg:px-2 xl:px-2.5`.

### 4. MainLayout Mobile Bottom Nav — "Más" not translated
**File:** `src/components/layout/MainLayout.tsx` (line 535)
- Hardcoded "Más" string — should use `t('nav.more')` for i18n consistency.

### 5. Admin Dashboard — Stats cards text overflow on mobile
**File:** `src/pages/AdminDashboard.tsx` (line 139)
- `text-3xl` on stat values can overflow on `grid-cols-2` mobile layout. Use `text-2xl sm:text-3xl`.

### 6. Doctors Page — Country flag badges (from multi-currency migration)
**File:** `src/pages/Doctors.tsx`
- The previous plan added `country_code`/`country_flag` to profiles but doctor cards don't show flags yet. Add flag display next to doctor location.

### 7. LivesGrid — No country flags on live cards
**File:** `src/pages/LivesGrid.tsx`
- Live cards show doctor name but no country flag. Add flag from doctor profile data.

### 8. Wallet Page — Top-up amount buttons lack mobile-friendly spacing
**File:** `src/pages/Wallet.tsx`
- The `TOPUP_AMOUNTS` buttons should have consistent `min-h-[44px]` for touch targets.

### 9. ContentGallery — Premium content badge readability
**File:** `src/pages/ContentGallery.tsx`
- Ensure premium/paid badges have sufficient contrast on mobile.

### 10. RecordingsGrid — Grid consistency
**File:** `src/pages/RecordingsGrid.tsx`
- Verify grid uses same responsive pattern as LivesGrid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`.

### 11. Chat Page — Mobile split view
**File:** `src/pages/Chat.tsx`
- Already uses `useIsMobile()` for responsive split. No issues found.

### 12. Settings Page — Section spacing on mobile
**File:** `src/pages/Settings.tsx`
- Cards with `CardHeader` + `CardContent` should have consistent `p-4 sm:p-6` padding.

### 13. MedicalNews — Scrollable filter row
**File:** `src/pages/MedicalNews.tsx`
- Already has chevron arrows for desktop scrolling. No issues found.

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/components/doctor/DoctorStatsGrid.tsx` | Change `lg:grid-cols-6` → `lg:grid-cols-5` for even distribution |
| `src/components/layout/MainLayout.tsx` | Increase desktop nav text size from `text-[10px]` → `text-[11px]`, padding from `px-1` → `px-1.5`. Add i18n for "Más" |
| `src/pages/AdminDashboard.tsx` | Stat values: `text-3xl` → `text-2xl sm:text-3xl` |
| `src/pages/Doctors.tsx` | Add country flag emoji next to doctor location in cards |
| `src/pages/LivesGrid.tsx` | Add country flag on live cards (from doctor profile) |
| `src/pages/Wallet.tsx` | Add `min-h-[44px]` to top-up buttons for touch targets |
| `src/pages/DoctorProfile.tsx` | Show country flag in profile header |

## i18n Keys to Add
- `nav.more` → "Más" (es) / "More" (en)

## No Issues Found (Verified Working)
- All routes resolve correctly, no 404 risks
- Footer links all point to valid pages
- Chat responsive split works correctly
- MedicalNews filter scrolling works
- Settings page layout is clean
- Onboarding country step already added in previous message
- SplashScreen already redesigned

