

# Fix: New Users Skip Onboarding After Email Confirmation

## Root Cause

In `src/hooks/auth/fetchUserProfile.ts` line 26:
```typescript
onboardingCompleted: profile.onboarding_completed ?? true,
```

The nullish coalescing operator `?? true` means: if `onboarding_completed` is `null` or `undefined`, default to `true`. For newly registered users, this column is `null` in the database (no default value of `false` set), so the system treats them as having completed onboarding and redirects them directly to the dashboard.

## Fix

**File: `src/hooks/auth/fetchUserProfile.ts`** -- Change line 26:
```typescript
onboardingCompleted: profile.onboarding_completed ?? false,
```

Default to `false` when null. This ensures all new users go through onboarding after email confirmation, regardless of role (patient, doctor, resident).

**Database migration** -- Set the default value for `onboarding_completed` to `false` so new rows are never null:
```sql
ALTER TABLE public.profiles 
  ALTER COLUMN onboarding_completed SET DEFAULT false;
```

## Files to modify
- `src/hooks/auth/fetchUserProfile.ts` -- Change `?? true` to `?? false`
- Database migration -- Set column default to `false`

