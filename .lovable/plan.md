

# Plan: Complete Remaining i18n + News Translation + Header Spacing

## Status Check — What's Done vs Not Done

| Task | Status |
|------|--------|
| Specialty filters i18n | ✅ Done |
| TransactionHistory descriptions | ✅ Done |
| Vault page — structure/labels | ✅ Partially (many `t()` calls) |
| Vault page — toast messages | ❌ ~15 toasts still hardcoded Spanish |
| NewsArticle.tsx full i18n | ❌ Fully hardcoded Spanish (~30 strings) |
| News translate button | ❌ Not started |
| Header spacing | ❌ Not touched |

## Remaining Work

### 1. Vault.tsx — Replace ~15 hardcoded Spanish toast messages

Replace strings like:
- `'¡Almacenamiento ampliado exitosamente!'` → `t('vault.storageExpanded')`
- `'Error al cargar los médicos'` → `t('vault.errorLoadingDoctors')`
- `'Archivo subido correctamente'` → `t('vault.uploadSuccess')`
- `'Saldo insuficiente'` → `t('vault.insufficientBalance')`
- `'Se debitaron $X...'` → template with `t('vault.walletDebited')`
- `'Acceso otorgado/revocado correctamente'` → `t('vault.accessGranted/Revoked')`
- All error toasts → corresponding `t()` keys
- `"de"` in storage display → `t('common.of')`

### 2. NewsArticle.tsx — Full i18n migration (~30 strings)

- Import `useLanguage`, use `t()` for all UI strings
- Replace hardcoded: "Artículo no encontrado", "Volver a noticias", "Editar artículo", "Autor", "Editado el", "consultas", "seguidores", "Consulta:", "Consulta gratuita", "lecturas", "Ver X respuestas", "Ocultar respuestas", comment section strings
- Fix date locale: use `language === 'es' ? es : enUS`
- Add translate button for article content using Lovable AI edge function

### 3. News Translation Edge Function

Create `supabase/functions/translate-news/index.ts`:
- Accepts `{ title, content, targetLang }` 
- Uses Lovable AI (`google/gemini-3-flash-preview`) to translate
- Returns `{ title, content }` translated
- Client caches result in state, shows toggle "Show original" / "Translate"

### 4. Header Spacing Fix (`MainLayout.tsx`)

- Increase nav item padding: `px-1.5 lg:px-2 xl:px-3`
- Ensure right-side items have `gap-2` spacing

### 5. i18n Keys — Add ~40 new keys to en.ts and es.ts

New keys for vault toasts, NewsArticle strings, common.of, translate feature

## Files to Modify

1. `src/pages/Vault.tsx` — Replace 15 Spanish toast/display strings
2. `src/pages/NewsArticle.tsx` — Full i18n + translate button
3. `src/lib/i18n/en.ts` — Add ~40 keys
4. `src/lib/i18n/es.ts` — Add ~40 keys  
5. `src/components/layout/MainLayout.tsx` — Header spacing
6. `supabase/functions/translate-news/index.ts` — New edge function
7. `supabase/config.toml` — Register new function

