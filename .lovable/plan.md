

# Plan: Fix Push Notifications, Improve Settings/Wallet/Profile UX, AI Recommendation

## 1. Fix Push Notifications

**Root cause:** The `send-push-notification` edge function does NOT implement proper Web Push encryption (ECDH + AES-128-GCM) or VAPID JWT signing. It just does a plain `fetch()` to the push endpoint, which every push service rejects. Additionally, the client-side code uses `applicationServerKey.buffer` which can cause issues in some browsers.

**Fix:**
- **Edge function** (`supabase/functions/send-push-notification/index.ts`): Replace the broken `sendWebPush` with `npm:web-push` library which handles all the crypto properly. This is a well-tested Node/Deno library that does VAPID signing + payload encryption correctly.
- **Client hook** (`src/hooks/usePushNotifications.ts`): Remove `.buffer` cast — pass the `Uint8Array` directly to `pushManager.subscribe`. Add better error logging to surface the actual failure reason to the user.

## 2. Fix Missing Translations

Add to both `es.ts` and `en.ts`:
- `search.navigate`: "Navegar" / "Navigate"
- `search.select`: "Seleccionar" / "Select"  
- `search.close`: "Cerrar" / "Close"

## 3. Improve Settings Payment Section

In `src/pages/Settings.tsx` (lines 319-348), rewrite the "Gestionar Pagos" card:
- Change title to clearer text: "Pagos y Facturación" / "Payments & Billing"
- Simplify description to: "Revisa tus compras y métodos de pago" / "Review your purchases and payment methods"
- Remove the long explanatory paragraph below the button — replace with a short one-liner
- Make button text clearer: "Ver mis pagos" / "View my payments"

## 4. Wallet UX Polish

In `src/pages/Wallet.tsx`:
- Add a subtle gradient border to the balance card for more visual impact
- Make the "How it works" stepper collapsible (starts collapsed if balance > 0, expanded if empty) to reduce noise for returning users
- Add currency formatting consistency

## 5. Profile UX Polish

In `src/pages/UserProfile.tsx`:
- Add a wallet balance preview card for patients (quick glance without navigating away)
- Add a subtle divider between profile card and settings cards for visual breathing room

## 6. AI Recommendation

With $1 of Lovable AI credit, the best use for a medical platform is an **AI-powered medical Q&A assistant** in the DoubleCheck feature or a new "Ask AI" feature:
- Patients can ask general health questions before consulting a doctor
- Uses `google/gemini-3-flash-preview` (cheapest, fast) — at ~$0.001-0.01 per query, $1 covers 100-1000 queries
- This adds real value: patients get instant guidance, doctors get more qualified consultations

**I will NOT implement the AI feature in this batch** — just the fixes above. We can discuss the AI feature as a follow-up.

## Files to Modify
1. `supabase/functions/send-push-notification/index.ts` — rewrite with `npm:web-push`
2. `src/hooks/usePushNotifications.ts` — fix `.buffer` issue, better error messages
3. `src/lib/i18n/es.ts` — add missing search translations + payment text
4. `src/lib/i18n/en.ts` — same
5. `src/pages/Settings.tsx` — improve payment section UX
6. `src/pages/Wallet.tsx` — minor UX polish
7. `src/pages/UserProfile.tsx` — minor UX polish

