

# Plan: Show real verification status in Settings

The Settings page currently hardcodes a "Pendiente" badge and doesn't query the actual verification status from the database. The `/profile` page already does this correctly — we just need to replicate the same logic in Settings.

## Changes to `src/pages/Settings.tsx`

1. **Add state and effect** to fetch verification status from `identity_verifications` table (same pattern as UserProfile)
2. **Show dynamic badge** based on actual status: Verified (green), Pending (yellow), Failed (red), or "No verificado" if no record exists
3. **Update button text** — if already verified, show "Ver verificación" instead of "Iniciar verificación"
4. The button already navigates to `/identity-verification` which is correct

### Specific edits:
- Add `useEffect` import and state: `verificationStatus` 
- Add `useEffect` that queries `identity_verifications` for current user
- Replace hardcoded `Badge` with dynamic status badge
- Adjust button label based on status

