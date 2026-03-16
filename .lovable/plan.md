

# Plan: Phase 1 Revision — Complete Pending Items

## Issues Identified

### 1. "por consulta" appears twice on doctor cards
**File:** `src/pages/Doctors.tsx` line 686 — duplicate line. Remove one.

### 2. Clinical History: Saved but NEVER displayed
The `patient_clinical_history` table exists, data is saved during onboarding, but there's NO UI to view it. Missing:
- Patient viewing their own clinical history in profile
- Doctor viewing patient clinical history (when authorized via Vault permissions)

### 3. Controlled Access to Patient Medical Record
The Vault already has a doctor permission system (`grantAccess`/`revokeAccess`). But clinical history from onboarding is NOT included in the Vault view. Doctors who have vault access should also see the patient's clinical history.

### 4. Better Medical Record Organization
`MedicalHistory.tsx` has basic categories but missing: dates timeline view, document type icons, patient notes, upload history log.

### 5. Content Categories Expansion
`DoctorUpload.tsx` has specialty-based categories but lacks practical categories like: Cirugías, Casos Clínicos, Explicaciones, Procedimientos, Conferencias.

### 6. Admin Panel Enhancement
Already robust. Missing: a "Rangos de Doctores" link in admin modules, and a content moderation shortcut.

### 7. Doctor Ranks Logic
System exists in `useDoctorRanks.ts` + `AdminRanks.tsx`. Logic: ranks are defined with thresholds (min consultations, earnings, months active, rating). Highest matching rank is assigned. Admin can override per-doctor. BUT `AdminRanks` is not linked from `AdminDashboard`.

### 8. ForResidents page + footer link
No `ForResidents.tsx` exists. Footer default links don't include "Para Residentes".

### 9. Demo Ad Campaign
Need to seed a complete campaign with creatives via edge function or direct insert.

---

## Implementation

### A. Fix duplicate "por consulta" (Doctors.tsx)
- Line 686: Remove the duplicate `<p>` tag.

### B. Clinical History Viewer in Patient Profile (UserProfile.tsx)
- Fetch `patient_clinical_history` for the logged-in patient
- Display a collapsible "Historial Clínico" card with all fields (blood type, allergies, conditions, medications, surgeries, family history, emergency contact, height/weight)
- Allow editing inline

### C. Doctor Access to Patient Clinical History
- When a doctor views a patient's vault (already has permission system), also show the clinical history section
- Add a new component `src/components/vault/PatientClinicalHistoryView.tsx`
- Query `patient_clinical_history` where `patient_id = <patient_id>` — requires new RLS policy: "Doctors with vault access can view clinical history"

**DB Migration:**
```sql
CREATE POLICY "Doctors with vault access can view clinical history"
ON public.patient_clinical_history FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.vault_permissions vp
    WHERE vp.patient_id = patient_clinical_history.patient_id
    AND vp.doctor_id = auth.uid()
    AND vp.status = 'granted'
  )
);
```

### D. Enhanced Medical Record Organization (MedicalHistory.tsx)
- Add date-based timeline view (sort by `dateOfStudy`)
- Add document type icons (PDF icon, image icon, etc.)
- Add patient notes field per document
- Add upload history section showing recent uploads with timestamps
- Add category filter chips at top

### E. Expand Content Categories (DoctorUpload.tsx)
Update `CONTENT_CATEGORIES` to include:
```
'Cirugías', 'Casos Clínicos', 'Explicaciones', 'Procedimientos', 'Conferencias'
```
Also update `ContentGallery.tsx` filter tabs to match.

### F. Admin Dashboard — Add Ranks Module
Add to the admin modules in `AdminDashboard.tsx`:
```ts
{ id: 'ranks', icon: Trophy, href: '/admin/ranks', color: 'text-warning', 
  title: 'Rangos de Doctores', desc: 'Administra rangos y sus requisitos' }
```

### G. Doctor Ranks Logic (Explanation + Verify Admin Control)
Current logic in `useDoctorRanks.ts`:
- Ranks table: `doctor_ranks` with fields `min_consultations`, `min_earnings`, `min_months_active`, `min_rating`, `sort_order`
- `calculateDoctorRank()`: iterates ranks sorted by `sort_order` DESC, returns first where ALL thresholds are met
- `rank_override` on `doctor_profiles` allows admin to force a specific rank
- `AdminRanks.tsx`: Full CRUD (create, edit, delete ranks with all fields)
- This is already fully administrable. Just needs the link from AdminDashboard (item F above).

### H. Create "Para Residentes" Page + Footer Link

**New file:** `src/pages/ForResidents.tsx`
- Same structure as `ForDoctors.tsx` and `ForPatients.tsx`
- Teal/academic themed (GraduationCap branding)
- Benefits: Networking médico, Grupos de especialidad, Meets médicos, Casos clínicos, Mentorías, Certificados
- How it works: 4 steps
- Features list
- CTA to register

**Footer update:** Add `{ label: 'Para Residentes', href: '/for-residents' }` to `DEFAULT_FOOTER.platform` in `useFooterLinks.ts`.

**Route:** Add `/for-residents` in `App.tsx`.

### I. Seed Demo Ad Campaign
Create an edge function `seed-demo-campaign` or insert directly. The campaign needs:
- Campaign record with status `active`, budget, dates, target roles
- Creative images generated via AI image generation (Lovable AI)
- Creatives linked to placements

Since generating images via edge function is complex, I'll create static placeholder banner creatives with gradient CSS-based visuals, and insert campaign + creative records in a migration.

**Alternative approach:** Create a seeder component in admin that auto-creates a demo campaign with sample creatives uploaded to `ad-creatives` bucket.

---

## Files to Create
1. `src/pages/ForResidents.tsx` — Dedicated residents landing page
2. `src/components/vault/PatientClinicalHistoryView.tsx` — Clinical history display for doctors

## Files to Modify
1. `src/pages/Doctors.tsx` — Remove duplicate "por consulta" line
2. `src/pages/UserProfile.tsx` — Add clinical history viewer section for patients
3. `src/pages/MedicalHistory.tsx` — Enhanced organization (timeline, icons, notes, filters)
4. `src/pages/DoctorUpload.tsx` — Expand content categories
5. `src/pages/ContentGallery.tsx` — Match expanded categories in filters
6. `src/pages/AdminDashboard.tsx` — Add Ranks module link + Content moderation link
7. `src/hooks/useFooterLinks.ts` — Add "Para Residentes" to default footer
8. `src/App.tsx` — Add `/for-residents` route
9. `src/lib/i18n/es.ts` + `src/lib/i18n/en.ts` — New translation keys

## Database Migration
- Add RLS policy for doctors to view patient clinical history via vault permissions
- Seed demo ad campaign with creatives

## Implementation Order
1. Fix duplicate "por consulta" (instant)
2. Clinical history viewer in UserProfile
3. Doctor access to clinical history + RLS
4. Enhanced medical record organization
5. Expand content categories
6. Admin dashboard links (Ranks)
7. ForResidents page + footer + route
8. Demo ad campaign seed

