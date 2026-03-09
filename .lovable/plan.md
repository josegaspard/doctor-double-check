

# Plan: Reorder Nav Items + Optimize Mobile for Doctors & Recordings

## Changes

### 1. Reorder `navItems` array (`MainLayout.tsx`, line 74-88)

Change order to: **Lives → Recordings → Doctors → Content → News → rest**

Also make `recordings` visible to `visitor` role so non-logged-in users can browse.

```
Lives → Recordings → Doctors → Content → News → Chat → Prescriptions → ...
```

### 2. Update bottom tabs (`MainLayout.tsx`, lines 91-138)

Add Recordings to mobile bottom tabs for quick access:

- **Patient**: Lives, Recordings, Doctors, Chat + More
- **Doctor**: Lives, Recordings, Chat, Dashboard + More  
- **Visitor**: Lives, Recordings, Doctors, News + More (no More needed if ≤4)
- **Resident**: Lives, Recordings, Doctors, Notifications + More
- **Admin**: Lives, Recordings, Doctors, Admin + More

### 3. Recordings visibility for visitors

Add `'visitor'` to recordings navItem roles so visitors can browse (purchase requires login).

## Files to Modify

| File | Change |
|------|--------|
| `src/components/layout/MainLayout.tsx` | Reorder navItems; add Recordings to bottom tabs; add visitor to recordings roles |

