

# Plan: Country Display in Doctor Cards + Translation Fixes + OTP/SMS Confirmation

## 1. Show country flag + name in doctor cards and related views

The `profiles` table already has `country_code` and `country_flag`. The `get_doctors_paginated` RPC does NOT return these fields. We need to:

### Database migration
Alter the `get_doctors_paginated` function to JOIN `profiles` and return `country_code` and `country_flag` alongside existing fields.

### Code changes

**`src/pages/Doctors.tsx`**
- Add `country_code` and `country_flag` to the `DoctorRow` interface
- In each doctor card's stats bar (line ~704), show `country_flag` next to the location if available
- Format: `🇲🇽 Ciudad de México` instead of just `Ciudad de México`

**`src/pages/NutritionDirectory.tsx`** and **`src/pages/PsychologyDirectory.tsx`**
- Same treatment: show country flag in doctor cards

**`src/pages/DoctorProfile.tsx`**
- Show country flag next to location in the doctor's profile hero section

## 2. Fix raw translation keys showing as text

The screenshot shows `doctors.nearMe` displayed literally. This key is missing from both i18n files.

**`src/lib/i18n/es.ts`** — Add under `doctors`:
```
nearMe: 'Cerca de mí',
locationError: 'No se pudo obtener tu ubicación',
```

**`src/lib/i18n/en.ts`** — Add under `doctors`:
```
nearMe: 'Near me',
locationError: 'Could not get your location',
```

Also audit for any other `t('doctors.xxx')` calls that might be missing keys and add them.

## 3. OTP via SMS — Current Status Confirmation

The system **already supports SMS delivery** via the `send-otp-email` edge function. It integrates with:
- **Vonage** (Nexmo) — needs `SMS_API_KEY` + `SMS_API_SECRET`
- **Telnyx** — needs `SMS_API_KEY`

The `SMS_PROVIDER` env var selects between them (defaults to "vonage").

**For SMS to work, you need one of these:**
- **Twilio** — Available as a connector in Lovable Cloud. No API key needed from you; just connect it. This would require updating the edge function to use the Twilio connector gateway instead of Vonage/Telnyx direct calls.
- **Vonage** — Requires creating a Vonage account and adding `SMS_API_KEY` + `SMS_API_SECRET` as secrets.
- **Telnyx** — Requires a Telnyx account and adding `SMS_API_KEY`.

Email OTP already works via Resend (`RESEND_API_KEY`).

**Recommendation:** Use the **Twilio connector** since it's natively supported in Lovable Cloud — no manual API key setup needed. I would update the `send-otp-email` function to add Twilio as a third provider option.

## Files to modify
1. **Database migration** — Update `get_doctors_paginated` to return `country_code`, `country_flag`
2. `src/lib/i18n/es.ts` — Add `nearMe`, `locationError` keys
3. `src/lib/i18n/en.ts` — Add `nearMe`, `locationError` keys
4. `src/pages/Doctors.tsx` — Show country flag in cards, update interface
5. `src/pages/NutritionDirectory.tsx` — Show country flag
6. `src/pages/PsychologyDirectory.tsx` — Show country flag
7. `src/pages/DoctorProfile.tsx` — Show country flag in profile
8. *(Optional, pending your choice)* `supabase/functions/send-otp-email/index.ts` — Add Twilio connector support

