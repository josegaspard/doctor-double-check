

# Plan: Campaña con balance, panel de publicidad en perfil de usuario, fix mobile stats y limpieza

## Resumen de cambios

### 1. Balance de campaña basado en CPM/CPC (AdminAds + AdvertiserDashboard)
Actualmente se muestra `campaign.spent` pero no se calcula dinámicamente. Necesito calcular el gasto real:
- **Gasto = (impressions / 1000 × CPM) + (clicks × CPC)**
- **Saldo restante = budget − gasto**
- Mostrar en cada card de campaña: presupuesto, gastado, restante

**Archivos**: `src/pages/AdminAds.tsx`, `src/pages/AdvertiserDashboard.tsx`
- En AdminAds: mostrar perfil del anunciante (nombre, email, avatar) consultando `profiles` por `advertiser_id`
- Calcular `spent = (stats.impressions / 1000 * config.cpm_rate) + (stats.clicks * config.cpc_rate)` y mostrar balance restante
- En AdvertiserDashboard: mismo cálculo + sección de recomendaciones al final de la vista de detalle

### 2. Sección "Publicidad Contratada" en panel del usuario
Cualquier usuario que tenga campañas debe ver un enlace en el menú de navegación.

**Archivo**: `src/components/layout/MainLayout.tsx`
- Agregar link "Publicidad" / "My Ads" en el menú "More" que lleve a `/advertiser/dashboard` (solo visible si el usuario tiene campañas o siempre visible para todos)
- Dado que ya existe `/advertiser/dashboard`, solo necesito agregar el enlace en la navegación

### 3. Recomendaciones y exportación mejorada en AdvertiserDashboard
**Archivo**: `src/pages/AdvertiserDashboard.tsx`
- En la vista de detalle de campaña, agregar sección de insights:
  - Qué placement tiene más CTR
  - Qué rol de usuario da más clics
  - Recomendación de optimización basada en data
- Botón de exportar PDF con toda la data de la campaña individual
- Al finalizar campaña (status=completed): mostrar resumen final + botón "Crear nueva campaña"

### 4. Fix stats grid en DoctorProfile para móvil
**Archivo**: `src/pages/DoctorProfile.tsx` (líneas 489-519)

El problema es que `PriceDisplay` con `size="lg"` genera un texto largo como "$350.00 MXN" que en `grid-cols-3` con celdas pequeñas se rompe visualmente. La ubicación con bandera + texto largo también se trunca.

Solución:
- Cambiar `grid-cols-3` a `grid-cols-2 sm:grid-cols-3` en móvil para dar más espacio
- En la celda de precio: usar `PriceDisplay size="sm"` en móvil 
- En la celda de ubicación: truncar con `line-clamp-1` y eliminar flag que ocupa espacio
- Reducir padding en móvil: `p-2 sm:p-3`

### 5. Quitar layout 3 columnas de ContentGallery
**Archivo**: `src/pages/ContentGallery.tsx` (líneas 507-533)

El usuario pidió explícitamente quitar los sidebars de la biblioteca de contenido. Revertir a layout simple:
- Eliminar `grid-cols-[180px_1fr_180px]` y las dos `<aside>` de sidebars
- Mantener solo el banner horizontal superior (`content_inline`) y el inline cada 4 items
- Mantener el banner bottom

### 6. Verificar sticky de sidebars en NewsArticle
**Archivo**: `src/pages/NewsArticle.tsx`

Los sidebars ya tienen `sticky top-24 max-h-[calc(100vh-8rem)]`. El código se ve correcto (líneas 401-405 y 746-750). Sin embargo, podría ser que `overflow-hidden` esté causando problemas. Cambiar a `overflow-y-auto` y verificar que el `<aside>` tiene `self-start` (ya lo tiene).

## Archivos a modificar

1. `src/pages/DoctorProfile.tsx` — Fix stats grid mobile (grid-cols-2 en móvil, PriceDisplay más compacto)
2. `src/pages/ContentGallery.tsx` — Quitar sidebars, mantener solo ads inline y banners
3. `src/pages/AdvertiserDashboard.tsx` — Balance calculado, insights por placement/rol, exportar PDF individual, recomendaciones
4. `src/pages/AdminAds.tsx` — Perfil de anunciante, balance calculado por CPM/CPC
5. `src/components/layout/MainLayout.tsx` — Link "Publicidad" en menú
6. `src/pages/NewsArticle.tsx` — Ajuste menor sticky (overflow-y-auto)

