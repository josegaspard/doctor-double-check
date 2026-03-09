

# Plan: Doctors as Menu Item + Enhanced Global Search Bar

## Summary
1. Add "Doctors" as a regular nav item in the top/bottom navigation menus
2. Replace the current search button with a proper full-screen search experience (mobile) / inline expandable search bar (desktop)
3. Search accessible to all roles

## 1. Add "Doctors" to Navigation (`MainLayout.tsx`)

**Changes**:
- Add `{ labelKey: 'nav.doctors', href: '/doctors', icon: Stethoscope, roles: ['patient', 'resident', 'doctor', 'admin', 'visitor'] }` to the `navItems` array (between Lives and Recordings)
- This automatically adds it to desktop nav, tablet hamburger, and the "More" sheet
- For doctors: it's already in bottom tabs, so no overflow issue

## 2. Redesign Global Search (`GlobalSearch.tsx`)

**Current**: A small ghost button with a search icon that opens a Popover with Command palette. Works but feels hidden.

**New design**:
- **Desktop/Tablet**: Replace the search button in the header with a wider clickable search bar placeholder (like Spotify/Airbnb style) — `"Search doctors, recordings, lives..."` — that on click opens a full **Dialog/overlay** with the search experience
- **Mobile**: Search icon in header that opens a **full-screen overlay** (Sheet from top or Dialog fullscreen) with autofocus input, quick suggestion chips (Doctors, Recordings, Lives, Content), and results
- **Quick access chips**: Before typing, show category shortcuts — "Doctors", "Recordings", "Lives", "Content" — clicking them navigates directly to that section
- **Empty state**: Show trending/suggested categories instead of just "Search..."
- Keep existing search logic (RPC for doctors, direct queries for recordings/lives)
- Add content search (doctor_content table) to results
- Support `Cmd+K` / `Ctrl+K` shortcut

## 3. Search for Doctors Role

Doctors already have many nav items. The search icon stays compact in their header but gives access to the same full search experience — they can find recordings, content, other doctors, and lives to purchase.

## 4. i18n Keys

Add to `es.ts` and `en.ts`:
- `search.placeholder`: "Search doctors, recordings, lives..." / "Buscar doctores, grabaciones, lives..."
- `search.quickAccess`: "Quick access" / "Acceso rápido"
- `search.trending`: "Popular" / "Popular"
- `search.allDoctors`: "View all doctors" / "Ver todos los doctores"
- `search.allRecordings`: "View all recordings" / "Ver todas las grabaciones"
- `search.content`: "Content" / "Contenido"

## Files to Modify

1. **`src/components/layout/MainLayout.tsx`** — Add Doctors to navItems array; replace search button with expandable search bar (desktop) / icon trigger (mobile)
2. **`src/components/search/GlobalSearch.tsx`** — Full redesign: Dialog-based overlay with full-screen mobile support, quick access chips, content search, polished results
3. **`src/lib/i18n/es.ts`** + **`src/lib/i18n/en.ts`** — Add search-related i18n keys

