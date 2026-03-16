

# Plan: Publicidad mejorada, likes en live para doctores, y gestión de pagos admin

## 1. Sidebars sticky hasta antes del footer (NewsArticle)

Los sidebars ya usan `sticky top-24` pero no se detienen antes del footer. Cambiar el contenedor de cada sidebar para usar `sticky top-24` con un `max-height: calc(100vh - 120px)` y envolver en un contenedor con `self-start` para que el sticky se detenga naturalmente cuando el contenido principal termina (el sidebar no extiende más allá del grid row).

**Archivo**: `src/pages/NewsArticle.tsx` — líneas 401-405 y 746-750
- Cambiar `<div className="sticky top-24">` por `<div className="sticky top-24 max-h-[calc(100vh-8rem)]">` y asegurar que el `<aside>` tenga `self-start` para que el sticky se limite al contenido del artículo y se detenga antes del footer.

## 2. Likes visibles para el doctor durante transmisión

Tras revisar el código, el doctor **ya puede ver los likes** en tiempo real:
- `DoctorGoLive.tsx` línea 57: `const { viewerCount, likesCount } = useViewerCount(...)` con realtime subscription
- `LiveStreamView.tsx` línea 121: Muestra `likesCount || liveData.likesCount` en el overlay

Sin embargo, el `useViewerCount` en `DoctorGoLive` usa `autoJoin: false` — lo cual no afecta la suscripción realtime (que se ejecuta siempre en línea 53-101 del hook). **No hay bug aquí.** Si el doctor no ve los likes es porque el overlay se oculta después de unos segundos. Haré el conteo de likes **siempre visible** en la interfaz del doctor (fuera del overlay que se auto-oculta).

**Archivo**: `src/components/live/LiveStreamView.tsx`
- Agregar un badge de likes persistente (fuera del overlay auto-hide) visible siempre en la esquina superior, similar al `AnimatedViewerCount`.

## 3. Banner horizontal en Biblioteca de Contenido + más publicidad tipo AdSense

### 3a. Cambiar `content_inline` a banner horizontal
**Archivo**: `src/pages/ContentGallery.tsx`
- El banner actual `content_inline` ya es horizontal por estar en un container full-width. El problema puede ser el placement format. Asegurar clase `aspect-[4/1]` o similar para forzar formato panorámico.

### 3b. Agregar más espacios publicitarios (estilo Google AdSense)
- **Sidebar ads** en desktop (3-column layout como en NewsArticle)
- **Inline ads entre cards** del grid cada N items (ej: después del item 4 y 8)
- **Banner bottom** antes del footer

**Archivo**: `src/pages/ContentGallery.tsx`
- Reestructurar a layout 3 columnas en desktop: `sidebar | content | sidebar`
- Insertar `AdBanner` inline entre bloques de 4 cards en el grid
- Agregar `content_sidebar_left`, `content_sidebar_right`, `content_bottom_banner` como nuevos placements

### 3c. Crear nuevos ad placements en la base de datos
**Migración SQL**: Insertar nuevos placements:
- `content_sidebar_left` (vertical/sidebar)
- `content_sidebar_right` (vertical/sidebar)  
- `content_mid_inline` (horizontal/inline)
- `content_bottom_banner` (horizontal/banner)

### 3d. Vincular nuevos placements a la campaña activa
Crear nuevos `ad_creatives` para la campaña existente apuntando a los nuevos placements con las imágenes de banner ya disponibles en `/src/assets/`.

## 4. Vista de todos los pagos de la plataforma para admin

El AdminPayouts actual solo muestra doctores con `pending_earnings > 0`. Falta una vista integral de **todas las transacciones** de la plataforma.

**Archivo**: `src/pages/AdminPayouts.tsx`
- Agregar un tercer tab: **"Todas las Transacciones"** / "All Transactions"
- Este tab consulta `wallet_transactions` con filtros por:
  - Tipo (purchase, topup, earning, refund)
  - Rango de fechas
  - Usuario específico (búsqueda)
- Muestra una tabla con: fecha, usuario, tipo, monto, descripción, estado
- Incluir totales agregados (total ingresos, total compras, etc.)
- Botón de exportar CSV para contabilidad

## Archivos a modificar

1. `src/pages/NewsArticle.tsx` — Sticky sidebars con límite antes del footer
2. `src/components/live/LiveStreamView.tsx` — Badge de likes siempre visible para doctor
3. `src/pages/ContentGallery.tsx` — Layout 3 columnas + ads inline entre cards + banner horizontal
4. `src/pages/AdminPayouts.tsx` — Tab de "Todas las Transacciones" con filtros y export
5. **Migración SQL** — Nuevos ad placements + creatives vinculados a campaña activa

