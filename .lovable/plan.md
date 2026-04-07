

# Plan: Client Feedback Implementation — Comprehensive Changes

## Analysis of what's ALREADY done vs what STILL NEEDS changes

Many items from the client's list were already implemented in prior iterations. Here's what **still needs work**:

---

## 1. Live Setup — Add "Content Type" question as FIRST step

**File:** `src/components/live/LiveSetupForm.tsx`

Currently the live setup form starts with "¿De qué trata tu live?" — the client wants the **first question** when going live or uploading content to be:
- **Contenido médico** (for professionals)
- **Contenido para pacientes** (for patients)

Add a new "content target" selector as Section 0 (before everything else) in `LiveSetupForm.tsx` with two visual cards: "Contenido médico" and "Contenido para pacientes". This maps to the existing `audience_type` field but as a prominent first-step choice. Add `contentTarget` to the `LiveConfig` interface.

---

## 2. DoctorUpload — Same "Content Type" first question

**File:** `src/pages/DoctorUpload.tsx`

Same as above — add a prominent content target selector before the file upload area. Two big cards: "Contenido médico" / "Contenido para pacientes". This replaces/precedes the existing `AudienceSelector` component.

---

## 3. ContentGallery — Reorder tabs: Access FIRST, then specialties

**File:** `src/pages/ContentGallery.tsx`

The tabs at the top should be reordered to: **Todo → Gratis → Comprados** (access filter first). The sidebar on desktop currently has "Tipo de contenido" first then specialties — but it also has a **duplicate** "Tipo de contenido" section (lines 467-488 AND 516-537). Fix: Remove the duplicate, and ensure the sidebar order is:
1. **Acceso** (Todo, Gratis, Comprados)
2. **Especialidades** 
3. **Tipo de contenido**
4. **Categorías**

Also, the "Subir contenido" button should only show for doctors (currently shows for all logged-in users).

---

## 4. ContentGallery — Red "Subir contenido" button for doctors

**File:** `src/pages/ContentGallery.tsx`

The upload button already exists with `variant="live"` (red). Just need to restrict visibility to `role === 'doctor'` instead of `!!user`.

---

## 5. Hospital Locator — Fix button colors

**File:** `src/pages/HospitalLocator.tsx`

The badges "🏨 Privado" and "🏥 Público" use `variant="secondary"` with `bg-background/90` which results in white-on-white in some themes. Change to use colored badges:
- **Público**: Blue badge (`bg-blue-600 text-white`)
- **Privado**: Purple badge (`bg-purple-600 text-white`)
- **Clínica**: Teal badge (`bg-teal-600 text-white`)

Also fix the Google Maps and Waze buttons to ensure proper contrast.

---

## 6. Lives — Chat mode "Solo chat de pago" → already says "Solo pacientes suscritos" ✅

Looking at `LiveSetupForm.tsx` lines 359-364, this is **already done**: the `paid_only` mode says "Solo pacientes suscritos" with description "Solo pueden comentar los pacientes que estén suscritos a ti". **No change needed.**

---

## 7. Doctors directory — Hide consultation prices ✅

Already implemented per memory. **No change needed.**

---

## 8. Chat — Remove "1:1" ✅

Already implemented per memory. **No change needed.**

---

## 9. Meetings — Meeting type selector ✅

Already implemented (meeting_type with "case_discussion" and "resident_class"). **No change needed.**

---

## 10. Patient location for prescription restriction ✅

Already implemented per memory. **No change needed.**

---

## 11. Panel: "Escribir artículo" → "Subir contenido" ✅

Already done. **No change needed.**

---

## 12. Medical Record for doctors/residents ✅

Already in nav for `['patient', 'resident', 'doctor']`. **No change needed.**

---

## 13. Hospital locator in nav ✅

Already in nav for `['patient', 'doctor', 'resident']`. **No change needed.**

---

## 14. Expediente Médico enhancements (chronic diseases, medications, surgeries, habits, vaccines) ✅

Already implemented with structured data per memory. **No change needed.**

---

## 15. Content audience filter ("solo para médicos y residentes") ✅

AudienceSelector already has "professionals" option. **No change needed.**

---

## Summary of ACTUAL changes needed

| # | What | File(s) |
|---|------|---------|
| 1 | Add "Contenido médico / Contenido para pacientes" as first question in Live setup | `src/components/live/LiveSetupForm.tsx` |
| 2 | Same first question in DoctorUpload | `src/pages/DoctorUpload.tsx` |
| 3 | Fix ContentGallery sidebar order + remove duplicate + add Access filter first | `src/pages/ContentGallery.tsx` |
| 4 | Restrict "Subir contenido" button to doctors only | `src/pages/ContentGallery.tsx` |
| 5 | Fix Hospital Locator badge colors (Público/Privado/Clínica) | `src/pages/HospitalLocator.tsx` |

---

## Technical Details

### LiveSetupForm.tsx changes
- Add new `contentTarget: 'medical' | 'patients'` field to `LiveConfig` interface
- Add a new Section 0 before the current Section 1 with two visual `ChatModeCard`-style cards:
  - 🩺 "Contenido médico" — "Para profesionales de la salud"
  - 👥 "Contenido para pacientes" — "Para pacientes y público general"
- Map this to the `audience_type` when saving

### DoctorUpload.tsx changes  
- Add the same content target selector before the file upload area
- Two prominent cards matching the same design
- Pre-set `audienceType` based on selection ('professionals' or 'patients')

### ContentGallery.tsx changes
- Fix: lines 467-488 duplicate the content type filter that also appears at 516-537. Remove the first one (or reorganize)
- Reorder sidebar to: Access tabs → Specialties → Content Type → Categories  
- Change `{user && (` to `{user && role === 'doctor' && (` for the upload button
- On mobile, ensure the tabs show access filter (Todo/Gratis/Comprados) prominently

### HospitalLocator.tsx changes
- Line 145: Change badge classes from `bg-background/90 backdrop-blur` to colored variants:
  - `public` → `bg-blue-600 text-white`
  - `private` → `bg-purple-600 text-white`  
  - `clinic` → `bg-teal-600 text-white`

