

# Fix: RLS policies blocking onboarding for doctors, residents, and wallets

## Problem
The `handle_new_user` trigger creates doctor/resident profiles and wallets on signup. However, when a user registers with a role chosen during onboarding (not signup), or the trigger's insert gets a duplicate, the onboarding page tries to INSERT directly from the client. There are **no INSERT RLS policies** for authenticated users on `doctor_profiles`, `resident_profiles`, or `wallets` -- only admins have ALL access.

## Solution: Two-pronged fix

### 1. Change onboarding inserts to UPSERT
Since the trigger may have already created these rows, use `.upsert()` instead of `.insert()` in `Onboarding.tsx` for `wallets`, `doctor_profiles`, and `resident_profiles`. This handles both cases (row exists or doesn't).

### 2. Add INSERT RLS policies
Add INSERT policies so authenticated users can create their own rows:

```sql
-- doctor_profiles: users can insert their own
CREATE POLICY "Users can insert own doctor profile"
ON public.doctor_profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- resident_profiles: users can insert their own
CREATE POLICY "Users can insert own resident profile"
ON public.resident_profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- wallets: users can insert own wallet
CREATE POLICY "Users can insert own wallet"
ON public.wallets FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
```

### Files to modify
- **Database migration**: Add 3 INSERT policies
- **`src/pages/Onboarding.tsx`**: Change `.insert()` to `.upsert()` for wallets, doctor_profiles, and resident_profiles to handle idempotency

