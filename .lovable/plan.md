
# Plan: Dark Mode + Fix Double Back Arrow on Mobile

## Problem 1: Dark Mode Switch Does Nothing

The Settings page uses `useTheme()` from `next-themes`, but the app (`App.tsx`) is missing the `ThemeProvider` wrapper. Without it, `setTheme()` has no effect.

### Fix:
- Wrap the app in `ThemeProvider` from `next-themes` in `App.tsx`
- Configure it with `attribute="class"` (since Tailwind uses `.dark` class), `defaultTheme="light"`, and `storageKey="theme"`
- The dark mode CSS variables are already fully defined in `index.css` (the `.dark` class section), so once the provider is added, the entire platform will switch themes correctly

## Problem 2: Double Back Arrow on Mobile

`MobileBackHeader` (rendered inside `MainLayout`) shows a sticky back arrow on ALL non-root mobile pages. But ~44 individual pages (Settings, Prescriptions, Terms, Privacy, DoctorVault, LivePlayer, RecordingPlayer, etc.) also render their own `ArrowLeft` back button in their page header. This creates two overlapping back arrows on mobile.

### Fix Strategy:
Hide the per-page back buttons on mobile (`sm:hidden` → visible only on desktop) since `MobileBackHeader` already handles mobile navigation. This is cleaner than removing `MobileBackHeader` because:
- `MobileBackHeader` provides a consistent, sticky navigation experience
- Per-page buttons often navigate to specific routes (e.g., "Back to Panel") which is better UX on desktop

### Pages to update (add `hidden sm:flex` to back button):
1. `Settings.tsx` - line 70 (ArrowLeft navigate(-1))
2. `Prescriptions.tsx` - line 103 (ArrowLeft navigate(-1))
3. `Terms.tsx` - line 114 (ArrowLeft navigate(-1))
4. `Privacy.tsx` - line 147 (ArrowLeft navigate(-1))
5. `RecordingPlayer.tsx` - line 219 (ArrowLeft → recordings)
6. `LivePlayer.tsx` - line 391 (ArrowLeft → lives)
7. `DoctorVault.tsx` - line 192 (ArrowLeft → dashboard)
8. `DoctorRecordings.tsx` - line 457 (ArrowLeft → dashboard)
9. `IdentityVerification.tsx` - line 308 (ArrowLeft → profile)
10. `AdminUsers.tsx` - line 143 (ArrowLeft → admin)
11. `AdminResidents.tsx` - line 157 (ArrowLeft → admin)
12. `AdminVerifications.tsx` - line 249 (ArrowLeft → admin)
13. `AdminInvoiceReview.tsx` - line 309 (ArrowLeft → admin)
14. `AdminPayoutSettings.tsx` - line 174 (ArrowLeft → admin)
15. `DoctorAvailability.tsx` - back button
16. `DoctorContentLibrary.tsx` - back button
17. `ReportIssue.tsx` - back button
18. `ContentGallery.tsx` - back button

Also update `MobileBackHeader.tsx`:
- Make titles translatable using `t()` instead of hardcoded Spanish
- Add i18n page title mappings for both languages

## Problem 3: MobileBackHeader titles are hardcoded in Spanish

The `PAGE_TITLES` map and dynamic route fallbacks are all in Spanish. Need to replace with `t()` calls.

### Fix:
- Replace the static `PAGE_TITLES` object with translation keys
- Use `t()` for each title so it respects the language setting

## Summary of Changes

| File | Change |
|------|--------|
| `src/App.tsx` | Add `ThemeProvider` from `next-themes` wrapping the entire app |
| `src/components/layout/MobileBackHeader.tsx` | Use `t()` for all page titles |
| `src/lib/i18n/en.ts` | Add `backHeader` section with page titles |
| `src/lib/i18n/es.ts` | Add matching Spanish page titles |
| ~18 page files | Hide per-page back button on mobile (`hidden sm:flex`) |
