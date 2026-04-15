

# Fix: Specialties Showing labelKeys Instead of Names + Full Audit

## Problem
The specialties filter displays raw i18n keys like `doctors.specAlgology` because only ~35 of 110+ specialty translations exist in the i18n files. When `t()` can't find a key, it returns the key path as-is.

## Solution: Display `spec.value` directly

The `value` field in `SPECIALTIES_FILTER` already contains the correct Spanish name (e.g., "Algología", "Anestesiología Pediátrica"). Using `t(spec.labelKey)` for 110+ medical terms is unnecessary — these are proper nouns that don't need translation. The fix is to show `spec.value` directly in all 3 files, with a special case for "Todas" which should still use `t()`.

### Files to change:
1. **`src/pages/Doctors.tsx`** — Replace `{t(spec.labelKey)}` with `{spec.value === 'Todas' ? t(spec.labelKey) : spec.value}` (2 occurrences)
2. **`src/pages/RecordingsGrid.tsx`** — Same pattern (2 occurrences)
3. **`src/pages/ContentGallery.tsx`** — Same pattern (2 occurrences)

### Alternative considered and rejected:
Adding 80+ missing translations to both `es.ts` and `en.ts` — this would be 160+ lines of maintenance burden for proper nouns that are essentially the same across languages.

---

## Full Platform Audit

Given the massive scope of the audit request, I will focus the plan on **actionable findings** organized by priority. The specialties fix above is the immediate P0 visual bug. The broader audit will be documented as a comprehensive report delivered alongside the fix, covering all areas requested (admin, doctor, financial, responsive, security, etc.) with specific file references and proposed solutions.

### Approach
1. Fix the specialties display bug (immediate, 3 files)
2. Conduct systematic code review across all modules
3. Deliver findings report with prioritized mega plan

Total estimated changes: 3 files for the specialty fix. Audit findings delivered as actionable items.
