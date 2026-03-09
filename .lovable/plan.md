

# Plan: Complete i18n Coverage + Browser Language Detection + Thumbnail Fix

## 1. Thumbnail Fix (ContentGallery.tsx)

**Root Cause**: Line 454 uses `content.thumbnail_url` directly. If `thumbnail_url` is a **storage path** (not an HTTP URL), it won't render. The signed URL logic on lines 284-300 only handles items WITHOUT `thumbnail_url`. Items that HAVE a `thumbnail_url` as a storage path are never signed.

**Fix**: In the `fetchContents` function, also sign `thumbnail_url` values that are storage paths (don't start with `http`). Change the `needThumb` filter to include ALL non-PDF content, and for items with a `thumbnail_url` that's a path, sign it; for items without, sign the `file_url` instead.

## 2. Browser Language Auto-Detection (LanguageContext.tsx)

**Current**: Defaults to `'es'` on first visit. No browser language detection.

**Fix**: On initial mount (no cached preference, no logged-in user preference), detect `navigator.language` and set `'en'` if it starts with `'en'`, otherwise keep `'es'`. Once the user manually changes language, it persists via localStorage and DB, overriding detection.

## 3. Add Missing i18n Keys for Ads System

The entire advertising system (AdminAds, Advertising, AdvertiserDashboard) and several other pages have hundreds of hardcoded Spanish strings using `language === 'es' ? '...' : '...'` inline or fully hardcoded. These need proper i18n keys.

### New keys to add to both `es.ts` and `en.ts`:

**`ads` section** (~60 keys) covering:
- Status labels: Borrador/Draft, Pago Pendiente/Payment Pending, En Revisión/In Review, Activa/Active, Pausada/Paused, Completada/Completed, Rechazada/Rejected
- Admin: Gestión de Publicidad, Campañas, Placements, Config, Configuración Global, Sistema de Publicidad, CPM, CPC, Presupuesto Mínimo, Tamaño Máx. Archivo, Guardar Configuración, Nuevo Placement, Nombre (slug), Nombre visible, Ancho, Alto, Descripción, Crear Placement, No hay campañas, Aprobar, Rechazar, Pausar, Reactivar, Creativos, Sin creativos, CTR Global, clics/impresiones, Impresiones y Clics, Ingresos Mensuales, Ingresos Totales, Campañas Activas
- Advertiser: Mis Campañas, Nueva Campaña, Crear Campaña, Nombre de la campaña, Presupuesto, Fecha inicio, Fecha fin, Audiencia objetivo, Pagar y Activar, Rendimiento, Subir creativo, URL de destino, Sin campañas aún, Crea tu primera campaña, Gastado, Mínimo
- Landing: Publicita en Medical Masters, Segmentación precisa, Métricas en tiempo real, App Store compliant, Activación instantánea, Calculadora de Presupuesto, Impresiones estimadas, Clics estimados, Espacios Disponibles, Crear mi campaña, Necesitas una cuenta registrada
- AdBanner component label
- Footer "Publicidad" link

**`recordings` section additions**:
- Todo/All, Gratis/Free, De Pago/Paid, Comprados/Purchased, Sin Comprar/Not Purchased (for RecordingsGrid filter chips)

**`content` section additions**:
- Tab labels: Todo/All, Comprados/Purchased, Nuevos/New
- Imagen/Image (for typeConfig label)

### Other hardcoded strings to migrate:
- `ContentGallery.tsx` typeConfig labels ("Video", "PDF", "Imagen") 
- `LiveConsultationBooking.tsx` "Saldo insuficiente"
- `Vault.tsx` "Saldo insuficiente"
- `UnifiedFooter.tsx` "Publicidad" label

## Files to Modify

1. **`src/lib/i18n/es.ts`** — Add `ads` section + missing keys in `recordings`, `content`
2. **`src/lib/i18n/en.ts`** — Mirror all new keys in English
3. **`src/contexts/LanguageContext.tsx`** — Add browser language detection on first visit
4. **`src/pages/ContentGallery.tsx`** — Fix thumbnail signing + use i18n keys for typeConfig and tabs
5. **`src/pages/AdminAds.tsx`** — Replace all hardcoded strings with `t()` calls
6. **`src/pages/AdvertiserDashboard.tsx`** — Replace all hardcoded strings with `t()` calls
7. **`src/pages/Advertising.tsx`** — Replace inline ternaries with `t()` calls
8. **`src/pages/RecordingsGrid.tsx`** — Replace hardcoded filter labels with `t()` calls
9. **`src/components/ads/AdBanner.tsx`** — Use i18n for "Publicidad" label
10. **`src/components/layout/UnifiedFooter.tsx`** — Use i18n for "Publicidad" link label
11. **`src/components/live/LiveConsultationBooking.tsx`** — Use i18n for "Saldo insuficiente"
12. **`src/pages/Vault.tsx`** — Use i18n for "Saldo insuficiente"

