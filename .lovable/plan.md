

# Plan: Vendor Registration Professionalization + UI Adjustments

## Changes

### 1. Professionalize Vendor Registration & Dashboard (`VendorDashboard.tsx`)
Currently a simple dialog with 5 fields. Redesign into a full-page multi-step registration flow:

- **Step 1**: Company info (name, description, logo upload, RIF/tax ID)
- **Step 2**: Contact details (phone, email, website, location/address)
- **Step 3**: Business documents (commercial license upload, bank details)
- **Step 4**: Review & submit

Replace the plain dialog with a professional card-based stepper UI with progress indicator. Add a hero section for the unregistered state with benefits/features callout. The pending state gets a professional timeline showing approval steps.

The approved vendor dashboard gets:
- Better stats cards with icons and trends
- A third tab "Analytics" with basic revenue chart
- Product cards with image previews, toggle active/inactive inline
- Order management with status badges and action buttons

### 2. ContentGallery — Remove ads, add gradient background (`ContentGallery.tsx`)
- Remove `AdBanner` import and both `<AdBanner>` instances (inline ad at line 427-431 and bottom banner at line 699)
- Remove the `AdBanner` import from line 3
- Add a gradient background to the page container: `bg-gradient-to-b from-primary/5 via-background to-background`
- Add a styled hero header section with gradient card background instead of plain text

### 3. Change lightning bolt to medical cross icon
**Files:** `EmergencyDoctors.tsx`, `Doctors.tsx`
- Replace `Zap` icon import with `Cross` (lucide-react `Plus` with custom styling to look like a medical cross)
- In EmergencyDoctors.tsx (line 73): `<Zap>` → `<Plus>` with medical cross styling
- In Doctors.tsx (lines 694, 712): same replacement
- Also update the i18n if needed (icon is code-only, no text change)

### 4. Remove Audience Type selector from DoctorUpload (`DoctorUpload.tsx`)
- Remove line 390: `<AudienceSelector value={audienceType} onChange={setAudienceType} disabled={!isApproved} />`
- Remove the `AudienceSelector` import (line 25)
- Keep `audienceType` state but default it based on `contentTarget` selection (medical → 'professionals', patients → 'patients') — this already happens in the content target selector (lines 321, 336)
- The "Content Target" selector (medical vs patients) stays — it replaces the audience type functionality

---

## Technical Summary

| # | What | File(s) |
|---|------|---------|
| 1 | Professional vendor registration stepper + enhanced dashboard | `VendorDashboard.tsx` |
| 2 | Remove ads, add gradient design to ContentGallery | `ContentGallery.tsx` |
| 3 | Zap → medical cross icon | `EmergencyDoctors.tsx`, `Doctors.tsx` |
| 4 | Remove AudienceSelector from upload form | `DoctorUpload.tsx` |

