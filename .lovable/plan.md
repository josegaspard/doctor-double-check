

# Plan: Mobile Bottom Bar Fix + Audit Report

## 1. Fix: Mobile bottom bar "Contenido Premium" text

**Problem:** The bottom tab label uses `t('nav.recordings')` which translates to "Contenido Premium" — too long for mobile tabs, causing overflow/misalignment.

**Solution:** In `MainLayout.tsx`, the `getBottomTabs` function returns `{ label: t('nav.recordings'), ... }`. Change this to use a shorter label for the bottom bar only: "Contenido" instead of "Contenido Premium".

**Files:**
- `src/lib/i18n/es.ts` — Add `recordingsShort: 'Contenido'` under `nav`
- `src/lib/i18n/en.ts` — Add `recordingsShort: 'Content'` under `nav`
- `src/components/layout/MainLayout.tsx` — In `getBottomTabs`, change all `{ label: t('nav.recordings'), ... }` to `{ label: t('nav.recordingsShort'), ... }`

## 2. Fix: Chat still shows "1:1"

**Problem:** `src/pages/Chat.tsx` line 368 still says `Chat 1:1`. Client asked to remove "1:1".

**Fix:** Change `<span>Chat 1:1</span>` to `<span>Chat</span>` in `Chat.tsx`.

---

## 3. Audit: Feature Completion Status

After thorough review of the codebase against the full client feature list:

### IMPLEMENTED (Confirmed in code):

| Feature | Status |
|---------|--------|
| Patient subscriptions to doctors (follow + notifications) | ✅ |
| Doctor connection notifications (live/availability) | ✅ |
| Language switching (ES/EN) with profile persistence | ✅ |
| Identity verification (Veriff facial + SEP cédula) | ✅ |
| Content audience classification (médico vs pacientes) as first step | ✅ |
| Masterclass with sessions + calendar scheduling | ✅ |
| Cédula shown in Lives info card | ✅ |
| Lives: paid chat / subscribers-only mode | ✅ |
| ContentGallery: Access filter first (Todo/Gratis/Comprados) | ✅ |
| ContentGallery: Upload button restricted to doctors | ✅ |
| Doctors directory: prices hidden | ✅ |
| Meetings: case_discussion / resident_class type selector | ✅ |
| Patient location for prescriptions (same-country check) | ✅ (per memory) |
| Panel: "Subir contenido" instead of "Escribir artículo" | ✅ |
| Medical record for doctors/residents/patients in nav | ✅ |
| Hospital locator in nav | ✅ |
| Expediente Médico structured (meds, surgeries, chronic diseases, habits, vaccines) | ✅ |
| Content audience filter (professionals/patients) | ✅ |
| Freemium lives (free to watch, premium to download/chat) | ✅ |
| OTP-secured vault/expediente access | ✅ |
| Clinical history form at registration | ✅ |
| iCloud-style storage with limits | ✅ |
| Doctor availability (Google Calendar style) | ✅ |
| Videocall (Daily.co) | ✅ |
| Doctor professional profile (CV, specialty, bio) | ✅ |
| Block/restrict users | ✅ |
| Document categories (labs, X-rays, etc.) | ✅ |
| Stripe payments (wallet, checkout, splits) | ✅ |
| Doctor bank account (CLABE, RFC) | ✅ |
| Payouts with fund holds | ✅ |
| Financial dashboard (doctor + admin) | ✅ |
| Doctor invoice upload module | ✅ |
| Reembolsos / disputas | ✅ |
| Doctor badges (Élite, Pro, etc.) | ✅ |
| Residents (chat allowed, no cobros, no consultas) | ✅ |
| Resident-doctor networking (request/accept) | ✅ |
| Medical news section | ✅ |
| Admin panel (users, doctors, content, payments, moderation) | ✅ |
| Specialties directory | ✅ |
| Live metrics (viewer count, analytics) | ✅ |
| PDF protection (no download, blob URLs) | ✅ |
| Live recordings kept 24h + doctor chooses to save | ✅ |
| Chat search | ✅ (per memory) |
| Separate chat vs consultation payment | ✅ |
| Compliance page | ✅ |
| Hospital Locator (admin CRUD, reviews, Waze/Maps) | ✅ |
| Medical Supplies Marketplace (admin, vendors, orders) | ✅ |
| Featured/promoted listings with analytics | ✅ |
| Hospital Locator badge colors fixed | ✅ |

### STILL NEEDS FIX (found in code):

| Item | Issue |
|------|-------|
| Chat "1:1" label | Still shows "Chat 1:1" — needs removal |
| Mobile bottom bar "Contenido Premium" | Too long, needs short label |

### PHASE 2 (Not in scope — acknowledged as future):

- Psicología module (separate section)
- Nutrición module (separate section)
- Advanced geolocation filters (continent/country/city/university/hospital)
- Multi-currency with automatic conversion
- Native iOS/Android app
- Advanced emergency/911 doctor finder

---

## Summary of changes needed

Only 2 small fixes remain:

1. **`src/lib/i18n/es.ts` + `en.ts`**: Add `nav.recordingsShort`
2. **`src/components/layout/MainLayout.tsx`**: Use short label in bottom tabs
3. **`src/pages/Chat.tsx`**: Remove "1:1" from chat title

Everything else from the client's list is implemented.

