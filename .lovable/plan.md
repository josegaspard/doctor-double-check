

# Plan: Paid Chat Payment Options, Thumbnail Fix, Doctor Filters

## 1. Paid Chat: Wallet + Stripe, Configurable Duration

**Current state:** LiveChat already supports wallet-only payments with a hardcoded 5-minute highlight. Need to add:
- Configurable highlight duration by doctor (seconds per peso paid)
- Stripe payment option when wallet balance insufficient
- Payment method selector (wallet vs card) shown before sending

**Changes:**

### DB Migration
- Add `chat_highlight_seconds INT DEFAULT 120` to `lives` table (doctor configures how many seconds per message the highlight lasts based on price)

### `src/components/live/LiveSetupForm.tsx`
- Add `chatHighlightSeconds` field to `LiveConfig` interface
- When `chatMode` is `paid_only` or `mixed`, show a field: "Duración del destacado (segundos)" with default 120
- Pass it through to `DoctorGoLive.tsx`

### `src/pages/DoctorGoLive.tsx`
- Save `chat_highlight_seconds` to the `lives` row on creation

### `src/components/live/LiveChat.tsx`
- Fetch `chat_highlight_seconds` from settings (alongside existing `chat_mode`, `chat_price`)
- Replace hardcoded `5 * 60 * 1000` with `chatHighlightSeconds * 1000`
- When payment is needed, show a small payment method picker (two buttons: "Wallet ($X saldo)" and "Pagar con tarjeta") before sending
- Wallet path: existing `process_wallet_purchase` RPC
- Stripe path: call a new edge function `create-chat-checkout` that creates a Stripe checkout session and returns URL; on return, the message is auto-sent (or use a pending state)

### Edge Function: `supabase/functions/create-chat-checkout/index.ts`
- Accept `{ liveId, amount, messageContent, userName }` 
- Create Stripe Checkout session with `price_data` dynamic pricing
- On success via webhook, insert the `live_chat_messages` row with `is_paid: true`
- Return checkout URL

**UX flow for paid chat:**
1. User types message, clicks send
2. If paid mode, a small inline popover appears: "Wallet (saldo: $X)" or "Tarjeta" 
3. Wallet: instant debit + send. Tarjeta: redirect to Stripe checkout, message sent on webhook confirmation

---

## 2. Thumbnail: Only in Recordings, NOT in /lives

**Problem:** `LivePreviewPlayer` receives `thumbnailUrl` and shows it as fallback when Daily stream isn't connected yet. This makes the cover image appear in `/lives`.

### `src/pages/LivesGrid.tsx` (line 46)
- Change `thumbnailUrl={live.thumbnailUrl}` to `thumbnailUrl={undefined}` (or remove the prop entirely)
- This ensures the live grid always shows the real-time video preview or the default gradient placeholder, never the cover image

### `src/components/live/LivePreviewPlayer.tsx`
- No changes needed — it already handles `thumbnailUrl` being undefined gracefully (shows Video icon fallback)

The thumbnail will still appear in recordings pages since those reference `thumbnailUrl` from the recordings data.

---

## 3. Doctor Directory: Advanced Filters (Rating, University, Experience, Level)

**Current state:** Doctors page has search, specialty chips, city chips, and nearby toggle. Need to add rating, experience, and level filters without cluttering the UI.

### UX Approach: Collapsible "More Filters" section
- Below the existing city chips, add a small "Más filtros" button
- When expanded, show a compact horizontal row of filter controls:
  - **Rating mínimo**: Star selector (1-5) as small clickable stars
  - **Nivel**: Dropdown or chips (Nuevo, Activo, Destacado, Elite) based on `badge_override` / `DoctorBadge` logic
  - **Consultas mín.**: Small number input for minimum consultations (proxy for experience)
- These filters are applied client-side on the already-fetched `doctors` array (rating, badge, consultations are already in `DoctorRow`)
- University data is NOT in the current schema (`doctor_profiles` has no university field), so we skip that unless a migration is added

### `src/pages/Doctors.tsx`
- Add state: `minRating`, `selectedLevel`, `minConsultations`, `showAdvancedFilters`
- Add a `<Collapsible>` section below city chips with the filter controls
- Apply filters in the render: `doctors.filter(d => d.rating >= minRating && d.total_consultations >= minConsultations && ...)`
- Keep chips aesthetic consistent with existing specialty/city chips

---

## Files to Modify

1. `src/components/live/LiveChat.tsx` — payment method picker (wallet/stripe), configurable highlight duration
2. `src/components/live/LiveSetupForm.tsx` — add `chatHighlightSeconds` config field
3. `src/pages/DoctorGoLive.tsx` — save `chat_highlight_seconds`
4. `src/pages/LivesGrid.tsx` — remove `thumbnailUrl` from LivePreviewPlayer
5. `src/pages/Doctors.tsx` — add collapsible advanced filters (rating, level, consultations)
6. `supabase/functions/create-chat-checkout/index.ts` — new edge function for Stripe chat payment

## DB Migration
```sql
ALTER TABLE lives ADD COLUMN chat_highlight_seconds INT DEFAULT 120;
```

