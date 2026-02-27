
# Plan: Multi-Feature Update - Chat UX, Wallet Layout, Doctor Cards, Translations, and Live Realtime

## 1. Chat Header Mobile Layout Fix

**File: `src/components/chat/ChatHeader.tsx`**

The uploaded screenshot shows text wrapping badly on mobile (specialty and office hours text breaking into multiple lines and overlapping). Fix:
- Wrap specialty + office hours in a single truncated line with `truncate` and `max-w` constraints
- Reduce font sizes on mobile for the info section
- Ensure the "Fuera de horario" text truncates instead of wrapping across 3 lines
- Add `overflow-hidden` to the info container

## 2. Wallet Transaction Stats - Horizontal 1-Row Layout on Mobile

**File: `src/components/wallet/TransactionHistory.tsx`**

Currently the stats grid is `grid-cols-3` but the amounts break into multiple lines on mobile (as shown in screenshot: "+$250,000" and "-$69,295" wrap). Fix:
- Keep `grid-cols-3` but use `text-sm` instead of `text-lg` on mobile for the amounts
- Add `truncate` or `whitespace-nowrap` to prevent line breaks in currency amounts
- Reduce padding on mobile: `p-2 sm:p-3`
- Use `text-xs` for amounts on very small screens and `text-base sm:text-lg` for larger

## 3. Doctor Cards - Full Card Clickable

**File: `src/pages/Doctors.tsx`**

Make the entire card navigate to the doctor profile (except the heart button and Pro badge area):
- Add `onClick={() => navigate(`/doctor/${doctor.user_id}`)}` to the Card component itself
- Ensure `e.stopPropagation()` is already on the heart button (it is)
- Remove the redundant individual `onClick` handlers from the avatar and name

## 4. Chat History Selection Mode - Better UX

**File: `src/components/chat/ChatSessionsList.tsx`**

The user says clicking "Seleccionar" isn't intuitive. Improvements:
- Change "Seleccionar" button to include a descriptive tooltip/text: use an icon + label like "Seleccionar para eliminar"
- When entering selection mode, show an instructional text: "Toca los chats que deseas eliminar" as a small helper banner
- Make the selection mode visually distinct: add a colored top banner (destructive/warning color) indicating "Modo seleccion - N seleccionados"
- The floating delete bar at the bottom should be more prominent with a fixed position

## 5. Missing Translations

**Files: `src/lib/i18n/es.ts`, `src/lib/i18n/en.ts`**

Add missing translation keys for hardcoded Spanish strings found in:
- `ChatHeader.tsx`: "Disponible", "Fuera de horario", "Cerrar esta orientacion", dialog texts
- `ChatSessionsList.tsx`: "Seleccionar", "seleccionado(s)", "Eliminar este chat?", etc.
- `Doctors.tsx`: "Como funciona?", "Seguir", "Suscripcion Pro", "Ver Perfil", "Explorar Doctores", specialty names
- `TransactionHistory.tsx`: "Historial de Transacciones", "Recargas", "Compras", "Ganancias", badge labels
- `ChatSessionItem.tsx`: various hardcoded strings
- Update all components to use `t()` calls instead of hardcoded strings

## 6. Realtime Live Cards on /lives

**File: `src/contexts/LivesContext.tsx`**

The realtime subscription already handles INSERT events and adds new lives to state (line 395: `return [updatedLive, ...prev]`). However, when the doctor name isn't in the profile cache, it falls back to "Doctor" and calls `throttledFetchLives()`. This should already work. The issue may be that the profile cache miss causes a delayed name display.

Fix: When a new live INSERT arrives with an uncached doctor ID, immediately fetch just that doctor's profile inline before adding to state, rather than triggering a full refetch. This ensures the card appears with the correct name instantly.

**File: `src/contexts/LivesContext.tsx` (line ~392)**
- When `!profileCache.current.has(record.doctor_id)`, fetch the single profile from `profiles_public` and update the cache before setting state, instead of calling `throttledFetchLives()`

## 7. Onboarding & Cedula Verification (Answer)

The onboarding flow is already fully implemented:
- After email verification, users are redirected to `/onboarding`
- Step 1: Role selection (Patient/Doctor/Resident) + avatar upload
- Step 2: For patients: clinical history form. For doctors: specialty + cedula profesional (7-8 digit number) with auto-verification via SEP API (`verify-cedula-sep` edge function using RapidAPI). For residents: institution + year.
- Step 3: Document signatures (Terms, Privacy, Doctor contract)
- Step 4: Welcome screen with confetti

The cedula auto-verification (`CedulaAutoVerify` component) calls the `verify-cedula-sep` edge function which validates the number against the SEP registry. After admin approval, the doctor gets their badge.

---

## Technical Summary

| File | Changes |
|------|---------|
| `src/components/chat/ChatHeader.tsx` | Fix mobile text overflow for specialty + office hours |
| `src/components/wallet/TransactionHistory.tsx` | Responsive stat amounts - `whitespace-nowrap`, smaller text on mobile |
| `src/pages/Doctors.tsx` | Make entire card clickable to navigate to doctor profile |
| `src/components/chat/ChatSessionsList.tsx` | Better selection mode UX with instructional banner and prominent delete bar |
| `src/lib/i18n/es.ts` | Add ~30 missing translation keys for chat, wallet, doctors |
| `src/lib/i18n/en.ts` | Add matching English translation keys |
| `src/components/chat/ChatHeader.tsx` | Use `t()` for hardcoded strings |
| `src/components/chat/ChatSessionsList.tsx` | Use `t()` for hardcoded strings |
| `src/components/wallet/TransactionHistory.tsx` | Use `t()` for hardcoded strings |
| `src/pages/Doctors.tsx` | Use `t()` for hardcoded strings |
| `src/contexts/LivesContext.tsx` | Inline single-profile fetch on new live INSERT for instant name display |
