

# Plan: Phase 2 Completion — What's Missing & Implementation

## Status Assessment

| Feature | Status | What's Missing |
|---------|--------|----------------|
| **Geolocation (Near me, city filters)** | Done | No continent/country filters. No hospital/university filters. |
| **Multi-currency system** | Partially done | `useCurrency`, `PriceDisplay`, `exchange_rates` table exist. But `PriceDisplay` is NOT used anywhere in the app — all prices still show raw `$amount`. Edge function for rates exists but has no INSERT/UPDATE RLS for service role. |
| **Country detection in onboarding** | Done | Country selector exists in onboarding. |
| **Country flags on doctor cards** | Not done | Doctor cards don't show flags. `DoctorRow` interface doesn't include `country_flag`. |
| **Psychology/Nutrition modules** | Not done | Specialties exist in onboarding list (`Nutriología`, `Psiquiatría`) but no dedicated section/landing pages. |
| **Emergency/911 module** | Not done | No "available now" quick-access view. |
| **Directory redesign (ABC-style)** | Partially done | Current directory is functional but not corporate/professional grade. Missing continent > country > city hierarchy. |
| **Native app (Capacitor)** | Partially done | `capacitor.config.ts` exists with basic config. Missing proper icons generation instructions. |

---

## Implementation Plan (What to Build Now)

### 1. Integrate PriceDisplay Everywhere Prices Appear

`PriceDisplay` exists but is unused. Replace raw `$amount` with `<PriceDisplay>` in:

| File | Location |
|------|----------|
| `src/pages/Doctors.tsx` line 534 | `${doctor.consultation_fee}` → `<PriceDisplay amount={doctor.consultation_fee} size="lg" />` |
| `src/pages/DoctorProfile.tsx` | Consultation fee display |
| `src/pages/Wallet.tsx` | Balance display and top-up amounts |
| `src/pages/RecordingsGrid.tsx` | Recording prices |
| `src/components/live/LiveConsultationBooking.tsx` | Consultation booking price |
| `src/components/subscriptions/SubscribeButton.tsx` | Subscription price |

### 2. Country Flag Badges on Doctor & Live Cards

**Doctors.tsx**: Extend `DoctorRow` interface to include `country_flag` (returned from the RPC `get_doctors_paginated` — may need a view update or join). If the RPC doesn't return it, fetch from profiles join. Show flag emoji next to location in doctor cards.

**LivesGrid.tsx**: Show country flag on live cards next to doctor name.

### 3. Continent > Country > City Geo Filters (Advanced Directory)

Add a tiered filter system to `Doctors.tsx`:
- **Continent chips**: Americas, Europe, Asia (derived from country codes in `COUNTRY_CURRENCIES`)
- **Country dropdown**: Filter by `country_code` from doctor profiles
- **City chips**: Already exist, keep them

This requires the `get_doctors_paginated` RPC to accept a `p_country` parameter, or client-side filtering on the country field.

### 4. University & Hospital Filters

`doctor_education` table has `institution` and `field_of_study`. Add filter options:
- Fetch distinct institutions from `doctor_education` where `status = 'approved'`
- Add a searchable dropdown "Universidad/Hospital" in the advanced filters section

### 5. Emergency / Available Now Module

Create a prominent "Doctors Available NOW" section at the top of the directory:
- A highlighted banner/card showing doctors where `isDoctorAvailableNow()` returns true
- Red/urgent styling with pulse animation
- Quick "Consult Now" button
- Can be a collapsible section at the top of `Doctors.tsx`

### 6. Psychology & Nutrition Dedicated Sections

Create two new pages with their own identity:
- `src/pages/PsychologyDirectory.tsx` — Filters to `Psiquiatría` specialty, custom hero with mental health branding
- `src/pages/NutritionDirectory.tsx` — Filters to `Nutriología` specialty, custom hero with wellness branding

Both reuse the doctor card component but with themed headers. Add routes in `App.tsx` and nav links.

### 7. Directory Redesign (Professional/Corporate)

Enhance `Doctors.tsx` with:
- A hero section with search (like Centro Médico ABC)
- Statistics bar ("500+ doctors, 20 specialties, 10 countries")
- Cards with more structured layout (photo left, info right on desktop)
- "Featured doctors" carousel at top

---

## Database Changes Needed

```sql
-- Allow edge function to upsert exchange rates (service role bypasses RLS, but if needed):
-- The existing INSERT/UPDATE restrictions on exchange_rates are correct for anon,
-- service_role bypasses RLS, so the edge function works fine.

-- No new tables needed. The existing schema supports all features.
```

The `get_doctors_paginated` RPC may need updating to return `country_flag` from profiles. Alternative: join in the view or add to the existing RPC.

## Files to Create
1. `src/pages/PsychologyDirectory.tsx` — Dedicated psychology section
2. `src/pages/NutritionDirectory.tsx` — Dedicated nutrition section

## Files to Modify
1. `src/pages/Doctors.tsx` — PriceDisplay integration, country flags, continent/country filters, university filter, emergency banner, hero redesign
2. `src/pages/LivesGrid.tsx` — Country flag on live cards
3. `src/pages/DoctorProfile.tsx` — PriceDisplay for consultation fee, country flag
4. `src/pages/Wallet.tsx` — PriceDisplay for balances
5. `src/pages/RecordingsGrid.tsx` — PriceDisplay for prices
6. `src/components/subscriptions/SubscribeButton.tsx` — PriceDisplay
7. `src/components/live/LiveConsultationBooking.tsx` — PriceDisplay
8. `src/App.tsx` — Add routes for psychology/nutrition pages
9. `src/components/layout/MainLayout.tsx` — Add nav links for psychology/nutrition
10. `src/lib/i18n/es.ts` + `en.ts` — New translation keys

## Implementation Order
1. PriceDisplay integration across all price-showing components (most impactful, already built but unused)
2. Country flag badges on doctor/live cards
3. Emergency "Available Now" banner
4. Continent > Country filter hierarchy
5. University/Hospital filter
6. Psychology & Nutrition dedicated pages
7. Directory hero redesign

