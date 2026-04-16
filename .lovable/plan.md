

# Fix: Synchronize Doctor Specialties with Canonical List

## Problem
The database has 5 doctor specialties that don't match the canonical `SPECIALTIES_FILTER` list:

| Current DB Value | Canonical Value |
|---|---|
| Cardiología | Cardiología Clínica |
| Ginecología | Ginecología y Obstetricia |
| Oncología | Oncología Médica |
| Ortopedia | Ortopedia y Traumatología |
| Psiquiatría | Psiquiatría Adultos |

The remaining 15 specialties (Anestesiología, Cirugía General, Dermatología, etc.) already match the canonical list exactly.

## Root Cause
Some doctors were created via the seed function or manually with shortened specialty names. The onboarding flow already uses `SPECIALTIES_LIST` correctly, so new doctors get canonical names — but existing records are wrong.

## Fix (3 steps)

### 1. Update existing DB records
Run 5 UPDATE statements to normalize the mismatched specialties to their canonical names:
- `UPDATE doctor_profiles SET specialty = 'Cardiología Clínica' WHERE specialty = 'Cardiología'`
- Same for the other 4 mismatches

### 2. Update `seed-demo-users` edge function
The seed function has its own hardcoded `SPECIALTIES` array (line 9-21). Replace it with the canonical names so future seeds create doctors with correct specialties. The mismatched entries are:
- "Cardiología Clínica" (not "Cardiología")  — note: seed actually doesn't have plain "Cardiología", so the manual/test doctors are the source
- Keep using the existing seed list but ensure every entry matches `SPECIALTIES_FILTER`

### 3. Update `resident_profiles` too
Check and fix any resident specialty mismatches with the same mapping.

## Technical Details
- Step 1: Use the Supabase insert/update tool (5 UPDATE queries)
- Step 2: Edit `supabase/functions/seed-demo-users/index.ts` lines 9-21
- Step 3: Query + update resident specialties if needed
- No schema changes needed — just data normalization

