

# Plan: Ad Banners in News, Fix "admin.manage", Profile Buttons UX, Footer "Para Residentes"

## 4 Issues to Fix

### 1. Sidebar Ad Banners on News Page + AdSense-style Placement

**Current state:** `MedicalNews.tsx` has no ad banners at all. Other pages only have top banners.

**Solution:** 
- **Desktop (lg+):** Change `MedicalNews.tsx` layout to a 3-column grid: left sidebar ad (vertical/sticky) | main news content | right sidebar ad (vertical/sticky). Use `AdBanner` with new placement names `news_sidebar_left` and `news_sidebar_right`.
- **Mobile:** Show one ad banner between the hero item and the grid (inline), no sidebars.
- Add a top banner on `MedicalNews.tsx` as well (`news_top_banner`).
- Also add inline ads in `Doctors.tsx` directory (after every ~6 cards) — subtle, non-abusive, like AdSense.

**File:** `src/pages/MedicalNews.tsx` — wrap content in a responsive grid with sticky sidebar ads on desktop, inline ad on mobile.

### 2. Fix "admin.manage" Raw Key Display

**Problem:** `t('admin.manage')` has no translation key in `es.ts` or `en.ts`. The `admin` object doesn't contain a `manage` key.

**Solution:** Add `manage: 'Gestionar'` to `admin` section in `es.ts` and `manage: 'Manage'` in `en.ts`.

**Files:** `src/lib/i18n/es.ts`, `src/lib/i18n/en.ts`

### 3. Doctor Profile Action Buttons — Better UX/UI

**Problem:** The current stacked layout (screenshot shows Orientación full-width, then Suscribirse alone, then Ver Lives + Bloquear) still looks disjointed. The buttons have inconsistent sizing and the "Bloquear" action is too prominent.

**Solution:** Create a clean action card layout:
```text
┌────────────────────────────────────┐
│  💬  Orientación ($3500 MXN)       │  ← Primary CTA, full-width, size="lg"
├────────────────────────────────────┤
│  🔔 Suscribirse    │  🎬 Ver Lives │  ← 2-col grid, outline buttons
├────────────────────────────────────┤
│          ⊘ Bloquear usuario        │  ← Ghost/link style, small, muted
└────────────────────────────────────┘
```

Key changes:
- Subscribe and Ver Lives in a **2-column equal grid** (both `variant="outline"`)
- Block button as a **small ghost link** below, not competing visually with primary actions
- All wrapped in a subtle `bg-muted/20 rounded-lg p-3` action panel

**File:** `src/pages/DoctorProfile.tsx` lines 586-635

### 4. Footer Missing "Para Residentes"

**Problem:** The default footer in `useFooterLinks.ts` already has "Para Residentes", but the `site_settings` DB value overrides it with the old list that doesn't include it. The spread `{ ...DEFAULT_FOOTER, ...dbValue }` replaces the entire `platform` array.

**Solution:** In `UnifiedFooter.tsx`, after getting `footerLinks.platform`, check if "Para Residentes" (or `/for-residents`) is missing and inject it. This ensures it always appears regardless of DB state.

**File:** `src/components/layout/UnifiedFooter.tsx`

---

## Files to Modify

1. **`src/pages/MedicalNews.tsx`** — Add 3-column layout with sidebar ads (desktop) + inline ad (mobile)
2. **`src/lib/i18n/es.ts`** — Add `manage: 'Gestionar'` to `admin` section
3. **`src/lib/i18n/en.ts`** — Add `manage: 'Manage'` to `admin` section
4. **`src/pages/DoctorProfile.tsx`** — Restructure action buttons into clean action panel
5. **`src/components/layout/UnifiedFooter.tsx`** — Ensure "Para Residentes" always appears in platform links

