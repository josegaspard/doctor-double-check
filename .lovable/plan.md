

# Plan: Twilio SMS for OTP + Fix Double-X in More Menu + Mobile UX Optimization

## 1. Twilio SMS Integration for OTP

### Step-by-step setup you need to do in Twilio:
1. Go to [twilio.com/console](https://www.twilio.com/console)
2. Copy your **Account SID** and **Auth Token** from the dashboard
3. Go to **Phone Numbers** > **Buy a Number** (or use the trial number they give you)
4. Copy the **phone number** (format: +1XXXXXXXXXX)

### What I will implement:
- Store 3 secrets: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- Update the `send-otp-email` edge function to also send SMS via Twilio API
- This requires the patient to have a phone number stored in their profile

### Database change:
- Add a `phone` column to `profiles` table (if not already present) so patients can optionally save their phone number
- The OTP will be sent via: in-app notification + email + SMS (if phone available)

## 2. OTP Timer Persistence (Background Countdown)

Currently, when the doctor closes the OTP dialog, the process is lost. The fix:

- Create an **OTP context/state** at the page level (not inside the dialog) that tracks:
  - `otpRequestedAt` timestamp
  - `patientId` / `patientName`
  - Time remaining (computed from `otpRequestedAt`)
- When the doctor closes the OTP dialog, show a **floating mini-banner** (sticky at top or bottom) with:
  - "OTP pendiente: 1:23 restante" + button to reopen the dialog
  - The countdown keeps running regardless of dialog state
- When the doctor clicks the banner, it reopens the OTP dialog with the remaining time shown
- If the timer expires, the banner disappears and shows a toast "Codigo expirado"

### Implementation:
- Add `otpTimerState` with `useState` in `DoctorVault.tsx`
- A floating `div` (fixed/sticky) that shows when OTP is active but dialog is closed
- `useEffect` with `setInterval` for the countdown
- The dialog and the banner share the same timer state

## 3. Fix Double-X in More Menu

The issue: The `SheetContent` component in `sheet.tsx` (line 67) **always renders a close X button** via `SheetPrimitive.Close`. But in `MainLayout.tsx` (line 517-522), we manually added another X button. Result: two X buttons.

### Fix:
- Remove the default close button from `SheetContent` when `side="bottom"` by passing a prop to suppress it, OR
- Remove the manual X button from MainLayout and rely on the built-in one, OR
- Best approach: Hide the default SheetContent close button for the "More" sheet by adding a custom `hideClose` prop to SheetContent

I will add a `hideClose` prop to `SheetContent` and use it in the "More" sheet, keeping only our custom styled X button.

## 4. Global Mobile UX/UI Optimization

Comprehensive pass across all mobile-facing files:

### MainLayout.tsx:
- Ensure `overflow-x-hidden` on root to prevent horizontal scroll
- Bottom nav: proper safe-area padding, touch targets min 44px
- More sheet: remove double X, ensure full rounded corners, proper scroll

### MobileBackHeader.tsx:
- Add `/doctor/dashboard` to ROOT_ROUTES (it's a main tab destination for doctors)
- Ensure it doesn't overlap with page content

### General patterns across pages:
- All containers use `px-4` with `max-w-full` to prevent lateral overflow
- Cards and dialogs constrained to viewport width
- Touch targets minimum 44px on all interactive elements
- Text truncation on long content to prevent overflow

## Summary of Changes

| File | Change |
|------|--------|
| `supabase/functions/send-otp-email/index.ts` | Add Twilio SMS sending alongside email and notification |
| `src/pages/DoctorVault.tsx` | Add persistent OTP timer state, floating mini-banner, background countdown |
| `src/components/ui/sheet.tsx` | Add `hideClose` prop to suppress default X |
| `src/components/layout/MainLayout.tsx` | Use `hideClose` on More sheet, mobile UX fixes |
| `src/components/layout/MobileBackHeader.tsx` | Add doctor dashboard to root routes |
| Database migration | Add `phone` column to profiles (if missing) |
| Secrets | Add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` |

## Sequence
1. First: Ask user for Twilio credentials via `add_secret`
2. Database migration for `phone` column
3. Fix double-X (sheet.tsx + MainLayout.tsx)
4. Implement OTP timer persistence + floating banner in DoctorVault
5. Update edge function for SMS
6. Mobile UX optimization pass

