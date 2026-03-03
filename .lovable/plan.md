

# Plan: Free SEP API + Fix Firma + Admin Doctor Details

## Problem Summary
1. **SEP verification uses RapidAPI** (paid, was giving 500 errors). User wants to switch to the free SEP Solr endpoint.
2. **"Firma requerida" blocks submit** but the DocumentSignature component is only shown for doctor/resident, yet validation errors are mapped to wrong fields (`errors.license` and `errors.specialty`), making the actual error message confusing.
3. **Admin needs to see all doctor onboarding data** (cedula verification details, institution, title, etc.) before approving.

## Changes

### 1. Switch to Free SEP Solr API
**File: `supabase/functions/verify-cedula-sep/index.ts`**

Replace the RapidAPI call with the free SEP endpoint:
```
http://search.sep.gob.mx/solr/cedulasCore/select?fl=*,score&q={cedula}&start=0&rows=10&wt=json
```

- Search by cedula number directly
- Parse the Solr response format (`response.docs[]` with fields: `nombre`, `paterno`, `materno`, `titulo`, `institucion`, `anioRegistro`, `numCedula`)
- Remove the `RAPIDAPI_KEY` dependency entirely
- Add fallback message: if the SEP endpoint is unreachable, suggest the user verify manually at `cedulaprofesional.sep.gob.mx` or wait for admin approval
- Match the cedula number from the results array to confirm verification

### 2. Fix Document Signature Visibility & Validation
**File: `src/pages/Onboarding.tsx`**

The DocumentSignature component IS rendered (lines 1311-1324), but the validation errors are misrouted:
- `errors.license = 'Firma requerida'` -- this shows under the cedula input, not the signature
- `errors.specialty = 'Acepta términos'` -- shows under specialty dropdown

Fix: Add proper dedicated validation error keys for signatures (`signerName`, `termsAccepted`, `privacyAccepted`, `doctorContract`) and display them near the DocumentSignature component. Also ensure patients see the DocumentSignature too (currently only doctor/resident see it).

### 3. Show All Doctor Data in Admin Panel
**File: `src/pages/AdminDoctors.tsx`**

Enhance the doctor card to fetch and display cedula verification data:
- Join `cedula_verifications` data when fetching doctor profiles
- Show: verified name from SEP, titulo, institucion, anio_registro, verification status
- Show location, document signatures status
- Display a "Verificado por SEP" badge if `cedula_verification_id` exists and `is_verified = true`

### Technical Details

**SEP Solr API response format:**
```json
{
  "response": {
    "numFound": 1,
    "docs": [{
      "nombre": "ENRIQUE",
      "paterno": "PEÑA",
      "materno": "NIETO",
      "numCedula": "1629426",
      "titulo": "LICENCIATURA EN DERECHO",
      "institucion": "UNIVERSIDAD PANAMERICANA",
      "anioRegistro": 1991,
      "tipo": "C1"
    }]
  }
}
```

**Validation fix mapping:**
- Current: signature errors written to `license`/`specialty` keys → displayed in wrong place
- New: separate error keys + inline error display below DocumentSignature

**Files to modify:**
1. `supabase/functions/verify-cedula-sep/index.ts` -- Replace RapidAPI with free Solr endpoint
2. `src/pages/Onboarding.tsx` -- Fix validation error mapping, show DocumentSignature for all roles
3. `src/pages/AdminDoctors.tsx` -- Show cedula verification details and all doctor data
4. `src/components/onboarding/DocumentSignature.tsx` -- Accept and display validation errors prop

