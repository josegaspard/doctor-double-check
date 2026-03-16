

# Plan: Ads Inside News Articles + Footer "Para Residentes" Fix

## Issue 1: Ads in the wrong place

The ads are currently on the `/news` listing page (MedicalNews.tsx) as top banner and sidebars. The user wants ads **inside individual news articles** (`NewsArticle.tsx`) as sidebars and inline — not on the listing grid.

### Changes to `src/pages/NewsArticle.tsx`
- Change the article layout from single-column `max-w-3xl` to a **3-column layout** on desktop: `lg:grid-cols-[180px_1fr_180px]`
- Add `AdBanner` for `news_sidebar_left` (left sticky sidebar, desktop only)
- Add `AdBanner` for `news_sidebar_right` (right sticky sidebar, desktop only)  
- Add `AdBanner` for `news_inline_mobile` (inline between article content and comments, mobile only)
- Add `AdBanner` for `news_top_banner` above the article content
- Import `AdBanner` and `useIsMobile`

### Changes to `src/pages/MedicalNews.tsx`
- Remove the 3-column sidebar layout — restore to a clean grid without sidebars
- Remove `news_sidebar_left` and `news_sidebar_right` ad placements
- Keep `news_top_banner` at the top of the listing
- Keep `news_inline_mobile` for mobile users on the listing

## Issue 2: "Para Residentes" missing from footer

The DB `footer_links` has only 3 items in `platform`: Para Doctores, Para Pacientes, Empresas. "Para Residentes" is missing.

### Database migration
Update the `footer_links` in `site_settings` to add "Para Residentes" after "Para Doctores" and reorder so it appears in the correct position:

```sql
UPDATE site_settings SET value = jsonb_set(
  value::jsonb,
  '{platform}',
  '[
    {"label":"Para Doctores","href":"/for-doctors"},
    {"label":"Para Residentes","href":"/for-residents"},
    {"label":"Para Pacientes","href":"/for-patients"},
    {"label":"Empresas","href":"/enterprise"}
  ]'::jsonb
) WHERE id = 'footer_links';
```

### Changes to `src/pages/AdminSiteSettings.tsx`
- Update the default `footerLinks.platform` initial state to include "Para Residentes" after "Para Doctores" so new installs also have it

## Files to modify
1. `src/pages/NewsArticle.tsx` — Add sidebar + inline ad placements within articles
2. `src/pages/MedicalNews.tsx` — Remove sidebar layout, restore clean news grid
3. `src/pages/AdminSiteSettings.tsx` — Update default platform links to include "Para Residentes"
4. **Database migration** — Add "Para Residentes" to footer_links in site_settings

