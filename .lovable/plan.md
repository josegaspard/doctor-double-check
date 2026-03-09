

# Plan: Full i18n Translation + Transaction Descriptions + Vault + Doctors Specialties + Search Bar Header Spacing

## Problems Identified

1. **Doctor specialty filters are hardcoded in Spanish** (`SPECIALTIES` array in `Doctors.tsx` uses raw Spanish strings like "Todas", "Cardiología")
2. **Transaction descriptions are in Spanish** — stored in DB by SQL functions and edge functions (e.g., "Consulta médica por chat", "Recarga via Stripe", "Expansión de almacenamiento"). These are server-side strings that can't be easily changed, so we need **client-side translation mapping**.
3. **Vault page is fully hardcoded in Spanish** — titles, buttons, labels, toast messages, storage dialogs, permissions dialog
4. **TransactionHistory date locale is hardcoded to `es`** — needs to use the user's language
5. **Header feels cramped** — nav items have tiny padding, search bar competes for space
6. **News translation** — news articles are stored in one language in DB; need AI-powered translation or dual-language support

## Changes

### 1. Doctors Page — Translate Specialty Filters (`src/pages/Doctors.tsx`)

Replace the hardcoded `SPECIALTIES` array with a mapped approach:
- Keep internal values in Spanish (since that's what the DB stores)
- Display labels via i18n: `doctors.specAll`, `doctors.specCardiology`, etc.
- Create a `SPECIALTIES` array of `{ value: string, labelKey: string }` objects

### 2. Transaction Description Client-Side Translation (`src/components/wallet/TransactionHistory.tsx`)

Since descriptions come from the DB in Spanish, add a `translateDescription(desc, lang)` utility that pattern-matches known descriptions:
- "Consulta médica por chat" → "Medical chat consultation"
- "Recarga via Stripe - ..." → "Top-up via Stripe - ..."
- "Expansión de almacenamiento: +XGB" → "Storage expansion: +XGB"
- "Grabación: X" → "Recording: X"
- "Solicitud aprobada: X" → "Approved request: X"
- "Segunda Opinión con X" → "Second Opinion with X"
- "Ganancia por consulta médica" → "Medical consultation earning"

Also fix the date locale: use `language === 'es' ? es : enUS` from `useLanguage()`.

### 3. Vault Page Full Translation (`src/pages/Vault.tsx`)

Replace all ~50+ hardcoded Spanish strings with `t()` calls. Add corresponding keys to both `en.ts` and `es.ts`:
- vault.title, vault.subtitle, vault.storage, vault.storageFull, vault.storageNearFull
- vault.needMoreSpace, vault.viewPlans, vault.youControlAccess, vault.youControlAccessDesc
- vault.uploadFile, vault.stepCategory, vault.stepDescription, vault.stepFile
- vault.descPlaceholder, vault.descRequired, vault.addDescFirst, vault.fileTypes
- vault.myFiles, vault.onlyYou, vault.permissions, vault.delete
- vault.emptyTitle, vault.emptyDesc, vault.uploadFirst
- vault.managePermissions, vault.currentAccess, vault.grantAccessTo, vault.grantAccessHint
- vault.searchDoctor, vault.noDocsAvailable, vault.noDocsAvailableDesc, vault.grantAccess, vault.revoke
- vault.allDocsHaveAccess, vault.noDocsFound
- vault.upgradeStorage, vault.storageUsage, vault.selectPlan, vault.residentDiscount
- vault.payWithCard, vault.useBalance, vault.insufficientBalance, vault.rechargeWallet, vault.changePlan
- vault.following, vault.chat, vault.consultation
- Toast messages: uploadSuccess, uploadError, deleteSuccess, deleteError, accessGranted, accessRevoked, etc.

### 4. i18n Keys Addition (`src/lib/i18n/en.ts` + `src/lib/i18n/es.ts`)

Add ~60 new keys covering:
- `doctors.spec*` — All specialty translations (14 specialties + "All")
- `vault.*` — All vault page strings (~40 keys)
- `transactions.descMap.*` — Transaction description translations

### 5. Header Spacing Fix (`src/components/layout/MainLayout.tsx`)

- Increase desktop nav item padding from `px-1 lg:px-1.5 xl:px-2.5` to `px-1.5 lg:px-2 xl:px-3`
- Reduce the search bar minimum width on desktop to avoid cramping
- Ensure right-side items have consistent spacing with `gap-2`

### 6. News Translation

For news articles (stored in DB), add a client-side translate button on the article page using the existing Lovable AI integration to translate the title/content on demand. This requires:
- A "Translate" button on `NewsArticle.tsx`
- Call to an edge function that uses AI to translate the text
- Cache translated version in state

## Files to Modify

1. **`src/pages/Doctors.tsx`** — Specialty filter i18n
2. **`src/components/wallet/TransactionHistory.tsx`** — Description translation mapping + locale-aware dates
3. **`src/pages/Vault.tsx`** — Full i18n migration (~50 strings)
4. **`src/lib/i18n/en.ts`** — Add ~60 new keys
5. **`src/lib/i18n/es.ts`** — Add ~60 new keys
6. **`src/components/layout/MainLayout.tsx`** — Header spacing improvements
7. **`src/pages/NewsArticle.tsx`** — Add translate button for news content

