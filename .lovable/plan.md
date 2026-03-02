

# Plan: Complete i18n Translation + Fix Content Deletion

## Problem 1: Deleted videos still showing

The previous FK constraint (`NO ACTION`) on `purchases.content_id` was silently preventing the DB record from being deleted when content had purchases. The migration to `ON DELETE SET NULL` was just applied, so **future deletions will work**. However, the videos you already tried to delete still have their DB records (the storage files may have been removed but the rows remain).

### Fix:
- In `DoctorContentLibrary.tsx`, reorder the delete logic: delete DB record FIRST, then storage files. If the DB delete fails, don't proceed with storage deletion. This prevents orphaned situations.
- Add error logging so if deletion fails, the toast shows the actual reason.
- The content you already "deleted" -- you'll need to try deleting them again from the library (they should now work with the new FK constraint).

## Problem 2: Hardcoded Spanish strings (30+ files)

There are hundreds of hardcoded Spanish strings scattered across the codebase. The plan is to:

### A. Add missing translation keys to `en.ts` and `es.ts`

New sections/keys needed:

**`content` section (additions):**
- `subscribers` ("Subscribers" / "Suscriptores")
- `subscribersOnly` ("Subscribers only" / "Solo suscriptores")
- `public` / `private`
- `free` / `myLibrary` / `filesUploaded`
- `restrictedAccess` / `onlyDoctorsCanView`
- `deleteContent` / `deleteContentConfirm` / `contentDeleted`

**`report` section (new):**
- `title` ("Report issue or abuse" / "Reportar falla o abuso")
- `subtitle`, `typeLabel`, `bugOption`, `abuseOption`, `otherOption`
- `subjectLabel`, `descriptionLabel`, `emailLabel`, `attachments`
- `submitButton`, `submitting`, `success`, `error`, `back`

**`news` section (additions to `medicalNews`):**
- `viewAll` ("View all" / "Ver todas")

**`footer` section (additions):**
- `reportIssue` ("Report issue or abuse" / "Reportar falla o abuso")

**`landing` footer section (new `landingFooter`):**
- `resources`, `successStories`, `help`, `contact`
- `legal`, `privacy`, `terms`, `security`, `compliance`, `reportIssue`

**`doctorLibrary` section (new):**
- `title`, `filesUploaded`, `uploadContent`, `allTypes`, `videos`, `pdfs`, `images`
- `public`, `private`, `deleteTitle`, `deleteDescription`, `deleting`, `deleted`

**`doctorContent` section (additions):**
- Various labels for audience types, upload form fields, etc.

### B. Update all component files to use `t()` or `useLanguage()`

Files requiring updates (hardcoded Spanish to `t()` calls):

1. **`src/components/news/NewsFeed.tsx`** - "Noticias Medicas", "Ver todas", date locale
2. **`src/components/layout/MainLayout.tsx`** - "Reportar falla o abuso" in footer
3. **`src/components/landing/LandingFooter.tsx`** - All footer links (Recursos, Ayuda, Contacto, Legal labels, "Reportar falla o abuso")
4. **`src/pages/ContentGallery.tsx`** - "Suscriptores", "Solo suscriptores" (lines 308, 317)
5. **`src/pages/DoctorContentLibrary.tsx`** - All hardcoded strings (Acceso restringido, Mi Biblioteca, expedientes subidos, Publico, Privado, Gratis, Todos, Profesionales, Pacientes, delete dialog, etc.)
6. **`src/pages/ReportIssue.tsx`** - All form labels (Reportar falla, Tipo de reporte, Asunto, Descripcion, etc.)
7. **`src/components/doctor/ConsultationFeeEditor.tsx`** - "Gratis", "Orientaciones gratis"
8. **`src/components/doctor/SubscribersModal.tsx`** - "Suscriptores", "Basica", "Gratis"
9. **`src/pages/DoctorAvailability.tsx`** - "Notificar suscriptores", "suscriptores"
10. **`src/components/doctor/DoctorQuickActions.tsx`** - Quick action labels

### C. Approach for inline ternaries (`language === 'es' ? ... : ...`)

There are ~2247 occurrences of `language === 'es' ?` ternaries across 38 files. These are technically "translated" but not using the `t()` system. For this pass, I will:
- Leave existing working ternaries as-is (they work correctly)
- Focus on files with **completely untranslated hardcoded Spanish** (no ternary at all)

## Summary of file changes

| File | Change |
|------|--------|
| `src/lib/i18n/en.ts` | Add ~40 new translation keys (report, doctorLibrary, content extras, footer extras, landing footer) |
| `src/lib/i18n/es.ts` | Add matching ~40 new translation keys in Spanish |
| `src/components/news/NewsFeed.tsx` | Use `t()` for title, "View all", and dynamic date locale |
| `src/components/layout/MainLayout.tsx` | Use `t()` for "Reportar falla o abuso" in footer |
| `src/components/landing/LandingFooter.tsx` | Use `t()` for all footer labels |
| `src/pages/ContentGallery.tsx` | Use `t()` for "Suscriptores", "Solo suscriptores" |
| `src/pages/DoctorContentLibrary.tsx` | Use `t()` for all strings, fix delete order |
| `src/pages/ReportIssue.tsx` | Use `t()` for all form labels and messages |
| `src/components/doctor/ConsultationFeeEditor.tsx` | Use `t()` for "Gratis" labels |
| `src/components/doctor/SubscribersModal.tsx` | Use `t()` for dialog labels |

