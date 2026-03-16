

# Plan: Watermark Fix, Scroll Fix, App Assets, UX Polish, Multi-Currency, Biometric & Accounting Recommendations

This is a large request. I will break it into what I can implement now vs. what requires external decisions.

---

## Part 1: Remove Watermark (Immediate Fix)

The watermark overlays in `RecordingPlayer.tsx` and `LivePlayer.tsx` show user email/ID as semi-transparent text. The user wants them removed entirely.

**Files to modify:**

| File | Change |
|------|--------|
| `src/pages/RecordingPlayer.tsx` | Remove the `Watermark` component (lines 198-214) and its usage (line 245) |
| `src/pages/LivePlayer.tsx` | Remove the `Watermark` component (lines 386-398) and its usage (line 472) |
| `src/index.css` | Remove the `.watermark` CSS class (lines 249-253) |

---

## Part 2: Fix Scroll on Content Gallery Navigation

The `ScrollToTop` component uses `navType !== 'POP'` which should work. The issue may be that on mobile, the `MainLayout` has internal scroll containers. I will force `window.scrollTo(0, 0)` on mount inside `ContentGallery.tsx` as a safety measure.

**File:** `src/pages/ContentGallery.tsx`
- Add `useEffect(() => { window.scrollTo(0, 0); }, []);` at mount

---

## Part 3: Native App Assets (Splash Screen, Icons)

For Capacitor native apps, I need to create proper app icons and splash screens. Since we don't have design assets, I will:

1. Create an `icons` generation config using the existing logo
2. Update `capacitor.config.ts` with splash screen settings
3. Add proper PWA icons to `public/manifest.json` with multiple sizes
4. Create a splash screen component for the app loading state

**Files to create/modify:**
- `public/manifest.json` - Add proper icon sizes (192x192, 512x512)
- `capacitor.config.ts` - Add splash screen and status bar config
- `src/components/SplashScreen.tsx` - New loading screen with branding

---

## Part 4: UX/UI Panel Optimization (PC, Tablet, Mobile)

I will audit the admin and doctor dashboards for:
- Spacing and readability on all breakpoints
- Broken links / 404 pages
- Empty states

This requires a thorough review. I will check routes and report any issues found, then fix the most impactful UI problems.

---

## Part 5: Multi-Currency System

This is a significant feature requiring:

### Database Migration
```sql
-- Add country/currency to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT 'MX';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS currency_code TEXT DEFAULT 'MXN';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country_flag TEXT DEFAULT '🇲🇽';
```

### New Edge Function: `get-exchange-rates`
- Fetch rates from a free API (e.g., exchangerate-api.com or Open Exchange Rates)
- Cache rates in a `exchange_rates` table (updated every hour)
- All prices stored in MXN internally, converted for display only

### Frontend Changes
- Onboarding: Auto-detect country via browser locale or IP geolocation
- Profile: Show country flag + currency
- All price displays: Wrap in a `<Price>` component that converts from MXN to user's currency
- Stripe checkout: Always charge in MXN (platform currency), but show the equivalent in user's local currency

### Doctor/Live Filters
- Add country flag badges on doctor cards, live cards
- Add country filter chips on Doctors page and Lives page

---

## Part 6: Biometric Recognition (Recommendation Only)

For biometric identity verification (face matching against government ID), I recommend:

**Best option: Veriff**
- Free trial available: https://www.veriff.com/pricing (14-day free trial)
- Supports ID verification + selfie matching
- Works globally, supports Mexican INE/IFE
- SDK for web and mobile
- Direct link: https://www.veriff.com/

**Alternative: Metamap (formerly Mati)**  
- Focused on Latin America, strong Mexico support
- Free trial: https://metamap.com/pricing
- Supports INE, CURP, and biometric face match
- Direct link: https://metamap.com/

**Budget option: Sumsub**
- https://sumsub.com/ - Free tier available for testing
- Good LATAM coverage

All three offer web SDKs that can be integrated as an edge function + frontend modal flow. The biometric data would be used for: registration verification, fast login (WebAuthn/passkeys for returning users), and identity confirmation for sensitive actions.

---

## Part 7: Mexican Accounting/Tax System (Recommendation Only)

For a Mexican accounting SaaS that can receive all platform transactions programmatically:

**Best option: Facturapi**
- Free plan available (50 facturas/mes): https://www.facturapi.io/
- Full CFDI 4.0 compliance (Mexican tax invoicing)
- REST API for creating invoices, tracking income/expenses
- Handles IVA, ISR retention calculations
- Direct link: https://www.facturapi.io/

**Alternative: Alegra**
- https://www.alegra.com/mx/ - Free plan available
- Full accounting + invoicing for Mexico
- API available for integration

**For complete accounting integration**, Facturapi is the best fit because:
- It has a REST API we can call from edge functions
- Every payment/payout event can auto-generate a CFDI
- It tracks income, expenses, tax obligations
- Free tier is sufficient for testing

---

## Implementation Priority (This Message)

I will implement Parts 1-3 now (watermark removal, scroll fix, app assets). Parts 4-5 are large features that will follow in subsequent messages. Parts 6-7 are recommendations requiring your decision on which services to use.

## Files to Modify

1. `src/pages/RecordingPlayer.tsx` - Remove watermark
2. `src/pages/LivePlayer.tsx` - Remove watermark
3. `src/index.css` - Remove watermark CSS
4. `src/pages/ContentGallery.tsx` - Fix scroll on mount
5. `capacitor.config.ts` - Add splash/status bar config
6. `public/manifest.json` - Better icon entries
7. `src/components/SplashScreen.tsx` - New branded splash screen

