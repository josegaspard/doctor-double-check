

# Fix: Specialty Data Sync + SearchableFilter for Specialty Selectors

## Problem
Three issues identified:

1. **Data mismatch in `lives` and `recordings` tables**: The previous fix only updated `doctor_profiles` and `resident_profiles`. The `lives` and `recordings` tables still have old values:
   - `Cardiología` → should be `Cardiología Clínica`
   - `Otra` → should be `Otra especialidad`
   - (Cirugía General, Dermatología, Gastroenterología, Endocrinología already match the canonical list)

2. **Recording/content cards display the raw DB specialty** (e.g., line 455 in RecordingsGrid: `{recording.specialty}`). Since the DB has "Cardiología", the card shows "Cardiología" while the filter uses "Cardiología Clínica" — so filtering never matches.

3. **The LiveSetupForm specialty selector is a native `<select>` with 110+ options** (screenshot confirms). This should use `SearchableFilter` for consistency. Same for ClinicalSessions and MeetingCreateDialog.

## Solution

### Step 1: Normalize DB data (SQL UPDATE)
```sql
UPDATE lives SET specialty = 'Cardiología Clínica' WHERE specialty = 'Cardiología';
UPDATE lives SET specialty = 'Otra especialidad' WHERE specialty = 'Otra';
UPDATE recordings SET specialty = 'Cardiología Clínica' WHERE specialty = 'Cardiología';
UPDATE recordings SET specialty = 'Otra especialidad' WHERE specialty = 'Otra';
```

### Step 2: Replace native `<select>` with SearchableFilter in creation forms
- **`src/components/live/LiveSetupForm.tsx`** (lines 286-296): Replace native `<select>` with `SearchableFilter`
- **`src/pages/ClinicalSessions.tsx`** (lines 252-264): Replace `Select`/`SelectContent` with `SearchableFilter`
- **`src/components/meetings/MeetingCreateDialog.tsx`** (lines 196-200): Replace `Select`/`SelectContent` with `SearchableFilter`

Each will use `SearchableFilter` with `options={SPECIALTIES}`, making 110+ specialties easily searchable.

### Step 3: No card changes needed
Once DB data is normalized, the cards (`{recording.specialty}`) will show correct values that match the filter options.

## Files modified
- `src/components/live/LiveSetupForm.tsx` — SearchableFilter for specialty
- `src/pages/ClinicalSessions.tsx` — SearchableFilter for specialty
- `src/components/meetings/MeetingCreateDialog.tsx` — SearchableFilter for specialty
- DB: 4 UPDATE queries on `lives` and `recordings`

