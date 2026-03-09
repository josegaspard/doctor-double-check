

# Plan: Wallet & Payment UX/UI Overhaul

## Problems
1. **PaywallModal** shows "Pay with Card" as primary and wallet as secondary — but if user HAS balance, wallet should be primary (instant). If user has NO balance, card should be primary (no extra step).
2. Text readability issues — some colors (like `text-warning/80`, `text-muted-foreground`) are too faint on certain backgrounds.
3. Users don't understand they need wallet balance to buy things — no clear onboarding/communication about the wallet system.
4. Wallet page itself lacks explanatory context about what the wallet is for.

## Changes

### 1. `PaywallModal.tsx` — Smart payment priority based on balance

**Logic change:**
- If `canAfford` (user has enough wallet balance) → show **Wallet as primary button** (solid/default), Card as secondary below with "o pagar con tarjeta" divider
- If `!canAfford` (insufficient or zero balance) → show **Card as primary button** (solid/default), wallet section below showing balance deficit + "Recargar" link
- Increase text contrast: replace `text-warning/80` with `text-warning-foreground` or `text-foreground`, replace faint muted colors with readable ones
- Make price text larger and bolder for clarity
- Add a brief explanation line: "Paga al instante con tu saldo" for wallet, "Pago seguro con tarjeta" for card

### 2. `Wallet.tsx` — Add explanatory hero section

- Add a short info banner below the header explaining what the wallet is for: "Tu billetera te permite comprar grabaciones, contenido premium y consultas de forma instantánea sin necesidad de ingresar tu tarjeta cada vez."
- Add 3 small benefit icons: "Compras instantáneas", "Sin tarjeta cada vez", "Historial completo"
- Improve text contrast on the balance card (ensure `text-primary-foreground` is fully opaque, not `/60` or `/80`)

### 3. `RecordingsGrid.tsx` — Better zero-balance CTA

- When balance is 0, make the CTA banner more prominent with clearer text: "Para comprar contenido premium necesitas saldo en tu billetera" with a larger "Recargar ahora" button
- When balance > 0 but low (less than cheapest recording), show a softer hint

### 4. `ContentGallery.tsx` — Add wallet awareness for premium content

- For premium content cards that require purchase, show a small wallet balance indicator or "Saldo insuficiente" warning if user can't afford it — making it clear before they click

## Files to modify
- `src/components/PaywallModal.tsx` — Smart priority + text contrast
- `src/pages/Wallet.tsx` — Explanatory hero
- `src/pages/RecordingsGrid.tsx` — Better zero-balance CTA
- `src/pages/ContentGallery.tsx` — Wallet awareness hints on cards

