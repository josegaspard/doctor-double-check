

# Plan: Fix Tabs Styling, Doctor Profile Access, Username in Onboarding, and SEP Verification UX Text

## Issues Identified

1. **Tabs still look bad** -- The screenshot shows the tabs on `/login` still have poor styling. The `TabsList` has `bg-muted/60` which at `hsl(187, 35%, 95%)` at 60% opacity is nearly invisible on white. Need stronger contrast.

2. **Doctor profile returns error for pending doctors** -- `/doctor/:id` uses `get_doctor_public_profile` RPC which filters `AND dp.status = 'approved'`. A newly registered doctor with `status: 'pending'` gets null, showing "Doctor not found". The page should show a limited profile for the doctor themselves or show a "pending verification" state.

3. **No username field in onboarding** -- The user wants a username (nombre de usuario) in addition to the full name. Currently there's no `username` column in profiles and no field in onboarding.

4. **SEP auto-verify needs UX text** -- Before the cedula auto-verify button, add an informative text saying "Si quieres acelerar tu proceso, puedes verificar tu cédula con nuestro verificador automático."

5. **Email confirmation should redirect to role-appropriate onboarding** -- Already handled by `useAuthState.ts` which checks role and redirects to `/onboarding`. The onboarding page already shows role-specific forms based on `selectedRole`. This works correctly.

## Changes

### 1. Fix TabsList and TabsTrigger styling (`src/components/ui/tabs.tsx`)
- `TabsList`: Use `bg-muted border border-border/80` with more visible background
- `TabsTrigger`: Keep `data-[state=active]:bg-primary data-[state=active]:text-primary-foreground` but add `data-[state=active]:shadow-md` for emphasis. The issue might be the `bg-muted/60` being too transparent -- change to `bg-muted` solid.

### 2. Add username field to database and onboarding
- **Migration**: Add `username` column to `profiles` table (text, unique, nullable)
- **Onboarding.tsx**: Add username input field in Step 1, after the avatar upload
- **Types**: No changes needed to `types.ts` (auto-generated)

### 3. Fix Doctor Profile for pending doctors (`src/pages/DoctorProfile.tsx`)
- When `get_doctor_public_profile` returns null, check if the current user is viewing their own profile
- If so, fetch directly from `doctor_profiles` + `profiles` (bypassing the `status = 'approved'` filter)
- Show a "pending verification" banner instead of "not found"

### 4. Add UX text before SEP auto-verify (`src/pages/Onboarding.tsx`)
- Before the `CedulaAutoVerify` component (line ~1186), add an informative card/alert with text: "Si deseas acelerar tu proceso de verificación, puedes utilizar nuestro verificador automático de cédula profesional. Este proceso es opcional, pero te permite avanzar más rápido."

## Files to Modify
- `src/components/ui/tabs.tsx` -- Fix contrast/styling
- `src/pages/Onboarding.tsx` -- Add username field + SEP verification UX text
- `src/pages/DoctorProfile.tsx` -- Handle pending doctor self-view
- **Database migration** -- Add `username` column to `profiles`

