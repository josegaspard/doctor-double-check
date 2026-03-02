

# Plan: Fix Double Back Arrows + Dark Mode Color Balance

## Problem 1: Double Back Arrows on Mobile

The `MobileBackHeader` component (inside `MainLayout`) already provides a consistent back arrow on ALL non-root mobile pages. However, many pages still render their OWN `ArrowLeft` back buttons visible on mobile, creating two arrows stacked on top of each other (as shown in the screenshot).

The previous fix applied `hidden sm:flex` to ~13 pages but missed several others.

### Strategy
**Keep `MobileBackHeader` as the ONLY back navigation on mobile.** Hide per-page back buttons on mobile screens using `hidden sm:flex` or `hidden sm:inline-flex`. These per-page buttons remain visible on desktop (sm+) where `MobileBackHeader` is hidden.

### Pages that still need `hidden sm:flex` on their back button:

| Page | Line | Current class |
|------|------|---------------|
| `DoctorProfile.tsx` | ~312 | `"mb-4"` (no hide) |
| `DoctorBankAccount.tsx` | ~222 | `"mb-4 gap-2"` (no hide) |
| `DoctorUpload.tsx` | ~263 | `"mb-4"` (no hide) |
| `DoctorInvoices.tsx` | ~266 | `"mb-4 gap-2"` (no hide) |
| `DoctorEarnings.tsx` | ~249 | `"mb-4 gap-2"` (no hide) |
| `NewsArticle.tsx` | ~294, ~304 | No hide on mobile |
| `AdminNews.tsx` | ~276, ~313 | `"mb-4 gap-2"` (no hide) |

**Pages NOT using MainLayout** (Help, Contact, Enterprise, Security, ForDoctors, ForPatients, SuccessStories) don't have `MobileBackHeader`, so their back buttons stay as-is.

## Problem 2: Dark Mode - Already Working But Needs Polish

The `ThemeProvider` is already wired in `App.tsx` and the dark mode toggle in Settings uses `useTheme()`. The `.dark` CSS variables are defined in `index.css`. So dark mode IS functional.

However, the screenshot shows the user is IN dark mode and seeing "Volver" text -- meaning the double arrow issue is the primary UX problem, not dark mode itself.

### Dark Mode Color Improvements

Some standalone/landing pages use hardcoded colors (e.g., `text-gray-600`, `hover:text-[#163a83]`) that don't adapt to dark mode. These will be replaced with semantic Tailwind classes:

| File | Hardcoded Color | Replace With |
|------|----------------|--------------|
| `Enterprise.tsx` | `text-gray-600 hover:text-[#163a83]` | `text-muted-foreground hover:text-primary` |
| `Help.tsx` | `text-gray-600 hover:text-[#163a83]` | `text-muted-foreground hover:text-primary` |
| `Security.tsx` | `text-gray-600 hover:text-[#163a83]` | `text-muted-foreground hover:text-primary` |

Also translate remaining hardcoded "Volver" strings in these pages.

## Summary of Changes

| File | Change |
|------|--------|
| `src/pages/DoctorProfile.tsx` | Add `hidden sm:inline-flex` to back button |
| `src/pages/DoctorBankAccount.tsx` | Add `hidden sm:inline-flex` to back button |
| `src/pages/DoctorUpload.tsx` | Add `hidden sm:inline-flex` to back button |
| `src/pages/DoctorInvoices.tsx` | Add `hidden sm:inline-flex` to back button |
| `src/pages/DoctorEarnings.tsx` | Add `hidden sm:inline-flex` to back button |
| `src/pages/NewsArticle.tsx` | Add `hidden sm:inline-flex` to back links, translate "Volver a noticias" |
| `src/pages/AdminNews.tsx` | Add `hidden sm:inline-flex` to back buttons, translate "Volver" |
| `src/pages/Enterprise.tsx` | Fix hardcoded colors for dark mode, translate "Volver al inicio" |
| `src/pages/Help.tsx` | Fix hardcoded colors for dark mode |
| `src/pages/Security.tsx` | Fix hardcoded colors for dark mode, translate "Volver al inicio" |

