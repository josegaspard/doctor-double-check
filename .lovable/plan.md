

# Plan: SplashScreen Redesign, UX/UI Audit, Multi-Currency System

## Links Requested

- **Veriff** (biometric, 14-day free trial): https://www.veriff.com/pricing
- **Facturapi** (accounting Mexico, 50 facturas/mes free, CFDI 4.0): https://www.facturapi.io/

---

## Part 1: SplashScreen Redesign

The current SplashScreen is plain white with a pulsing logo. It needs the landing page's dark gradient style.

**File: `src/components/SplashScreen.tsx`** — Complete rewrite:
- Background: `bg-gradient-to-br from-[#0b1d45] via-[#163a83] to-[#00768b]` (same as landing hero)
- Dot pattern overlay for texture (same as landing)
- Logo: use white logo, `w-20 h-20`, with a subtle scale-in animation (not ugly pulse)
- Title: "Medical Masters" in white, `font-heading font-bold`
- Tagline: "Tu salud, nuestra prioridad" in `text-slate-300`
- Loading bar: a smooth gradient bar `from-[#aed3d9] to-[#00768b]` with a sliding animation
- Floating background blobs (like landing) for depth
- Fade-out transition stays the same

**File: `src/App.tsx`** — Integrate SplashScreen:
- Import `SplashScreen`
- Add state `showSplash` (default `true`), render SplashScreen above everything when true
- On `onFinish`, set `showSplash` to `false`

**File: `src/index.css`** — Add `@keyframes loading` for the progress bar animation (slide left-to-right)

---

## Part 2: UX/UI Audit & Fixes (PC, Tablet, Mobile)

Based on code review of MainLayout, DoctorDashboard, LivesGrid, Doctors, and routing:

### Route Audit
All routes in App.tsx map to lazy-loaded components. No orphan routes found. All pages use MainLayout. No 404 risk from missing pages.

### Key UI Fixes

**File: `src/components/layout/MainLayout.tsx`**
- Mobile bottom nav: ensure icons have consistent sizing and active states are clearly visible
- Desktop sidebar sheet: verify proper width on tablet breakpoints

**File: `src/pages/DoctorDashboard.tsx`**
- On mobile, the tabs and stats grid can overflow — add `overflow-x-auto` on TabsList
- Reduce card padding on mobile from `p-6` to `p-4`

**File: `src/pages/LivesGrid.tsx`**
- Grid: ensure `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` for proper tablet layout
- Card text truncation on mobile

**File: `src/pages/Doctors.tsx`**
- Filter section: make collapsible on mobile to save space
- Doctor cards: ensure avatar + text don't overflow on small screens

These are incremental spacing/overflow fixes, not redesigns.

---

## Part 3: Multi-Currency System

### Database Migration (1 migration)

```sql
-- Add country/currency columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT 'MX';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS currency_code TEXT DEFAULT 'MXN';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country_flag TEXT DEFAULT '🇲🇽';

-- Exchange rates cache table
CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency TEXT NOT NULL DEFAULT 'MXN',
  target_currency TEXT NOT NULL,
  rate NUMERIC NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(base_currency, target_currency)
);

-- Public read access
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read exchange rates" ON exchange_rates FOR SELECT USING (true);

-- Update profiles_public view to include country
CREATE OR REPLACE VIEW profiles_public AS
  SELECT id, name, avatar_url, is_identity_verified, country_code, country_flag, created_at, updated_at
  FROM profiles;
```

### New Edge Function: `get-exchange-rates`
- Fetches from `https://open.er-api.com/v6/latest/MXN` (free, no API key)
- Upserts rates into `exchange_rates` table
- Called on-demand with client-side caching (1 hour TTL)

### New Component: `src/components/currency/PriceDisplay.tsx`
- Props: `amount` (in MXN), `className`
- Reads user's `currency_code` from auth context
- Fetches exchange rate from `exchange_rates` table (cached in React Query)
- Renders: `$29.00 MXN` or `≈ $1.50 USD` depending on user's currency
- Stripe always charges in MXN — this is display-only conversion

### New Hook: `src/hooks/useCurrency.ts`
- Returns `{ userCurrency, convertFromMXN(amount), formatPrice(amount) }`
- Gets user's currency from profile
- Gets exchange rate from cached query

### Onboarding Country Detection
**File: `src/pages/Onboarding.tsx`**
- Add a country selector step (or auto-detect via `navigator.language` locale → country mapping)
- Save `country_code`, `currency_code`, `country_flag` to profile on completion
- Show flag emoji next to country name

### Doctor/Live Filters
**File: `src/pages/Doctors.tsx`**
- Add country flag badge on each doctor card
- Add country filter dropdown in the filters section

**File: `src/pages/LivesGrid.tsx`**
- Add country flag badge on live cards (from doctor's profile)
- Add country filter chips

### Profile Display
**File: `src/pages/UserProfile.tsx`** and **`src/pages/DoctorProfile.tsx`**
- Show country flag + country name in profile header

---

## Files to Create
1. `src/components/currency/PriceDisplay.tsx`
2. `src/hooks/useCurrency.ts`
3. `supabase/functions/get-exchange-rates/index.ts`

## Files to Modify
1. `src/components/SplashScreen.tsx` — Complete redesign with landing gradient style
2. `src/App.tsx` — Integrate SplashScreen on app load
3. `src/index.css` — Add loading keyframe animation
4. `src/pages/Onboarding.tsx` — Add country detection/selection
5. `src/pages/Doctors.tsx` — Country flag badges + filter
6. `src/pages/LivesGrid.tsx` — Country flag badges + filter
7. `src/pages/UserProfile.tsx` — Show country flag
8. `src/pages/DoctorProfile.tsx` — Show country flag
9. `src/pages/DoctorDashboard.tsx` — Mobile spacing fixes
10. `src/components/layout/MainLayout.tsx` — Minor tablet/mobile spacing

## Database Migration
- Add `country_code`, `currency_code`, `country_flag` to `profiles`
- Create `exchange_rates` table
- Update `profiles_public` view

## Implementation Order
This message: SplashScreen redesign + integrate into App.tsx + CSS keyframes.
Next message: Multi-currency DB migration + edge function + PriceDisplay + onboarding country + filters.
Following: UX/UI audit fixes across all panels.

