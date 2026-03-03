

# Fix: Email Confirmation Link Redirects to Wrong URL

## Problem
When a user registers, `emailRedirectTo` is set to `window.location.origin`, which resolves to the Lovable preview URL (`cb26d7e6-...lovableproject.com`). The confirmation link in the email sends users to that preview URL + `/lives` instead of `cirugiaesteticauribe.com` with a proper confirmation page.

## Solution

### 1. Create `/email-confirmed` page
New file: `src/pages/EmailConfirmed.tsx`
- Detects the auth session from the URL hash (Supabase appends `#access_token=...&type=signup`)
- Shows a branded "Correo confirmado" success screen with checkmark animation
- After 3 seconds, auto-redirects to `/onboarding` (or `/lives` if onboarding already done)
- If no valid session found, shows "link expired" message with a button to go to `/login`

### 2. Fix `emailRedirectTo` in registration
**File: `src/hooks/auth/useAuthActions.ts`**
- Change `emailRedirectTo` from `window.location.origin` to `https://cirugiaesteticauribe.com/email-confirmed`
- This ensures the confirmation link always points to the production custom domain, not the preview URL

### 3. Add route
**File: `src/App.tsx`**
- Add `<Route path="/email-confirmed" element={<EmailConfirmed />} />`

### 4. Handle auth state on `/email-confirmed`
**File: `src/hooks/auth/useAuthState.ts`**
- Add `/email-confirmed` to the list of paths that trigger redirect logic (alongside `/` and `/login`)
- When `SIGNED_IN` event fires on this path, redirect to `/onboarding` if not completed

### Files to create/modify
- **Create**: `src/pages/EmailConfirmed.tsx`
- **Modify**: `src/hooks/auth/useAuthActions.ts` (line 68)
- **Modify**: `src/App.tsx` (add route)
- **Modify**: `src/hooks/auth/useAuthState.ts` (add `/email-confirmed` to redirect paths)

