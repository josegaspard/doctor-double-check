

# Plan: Add verified identity badge to doctor profiles

## What changes

### 1. Database: Update `get_doctor_public_profile` function
Add `is_identity_verified boolean` to the return type, selecting `p.is_identity_verified` from the profiles table (already exists there).

### 2. Frontend: `src/pages/DoctorProfile.tsx`
- Add `isIdentityVerified` to the `DoctorData` interface
- Map it from the RPC result: `isIdentityVerified: doctorProfile.is_identity_verified`
- In the badges section (line ~457), add a conditional verified-identity badge with a `CheckCircle` icon (matching the pattern already used in `Doctors.tsx` and `NutritionDirectory.tsx`):
  ```tsx
  {doctor.isIdentityVerified && (
    <Badge variant="verified" className="gap-1 text-xs">
      <CheckCircle className="w-3 h-3" />
      Identidad verificada
    </Badge>
  )}
  ```
- This replaces the current unconditional "Verified" badge (line 459-462) which always shows regardless of actual verification status

### Files to modify
- **Migration SQL** — `ALTER` the `get_doctor_public_profile` function to include `is_identity_verified`
- **`src/pages/DoctorProfile.tsx`** — add field to interface, map from data, render badge conditionally

