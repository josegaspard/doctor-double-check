

# Plan: Rediseño UX/UI del Panel de Doctor y Ganancias

## Resumen
Optimizacion completa del diseno y distribucion del Doctor Dashboard y /doctor/earnings para PC, tablet y movil. Solo cambios visuales y de usabilidad, sin tocar funcionalidad.

## Cambios en el Doctor Dashboard (`DoctorDashboard.tsx`)

### 1. Reorganizar la estructura del overview tab
Actualmente hay demasiadas cards apiladas sin jerarquia visual clara. Reorganizar en secciones logicas con separadores:

**Seccion 1 - Stats Grid** (sin cambios funcionales, solo visual)
- Mantener el grid de stats pero en movil usar scroll horizontal en lugar de grid 2x3 que corta contenido

**Seccion 2 - Quick Actions** (compactar en movil)
- En movil: reducir padding, iconos mas pequenos, grid de 1 columna
- En tablet: grid de 2 columnas
- En desktop: grid de 3 columnas (sin cambio)

**Seccion 3 - Finanzas y Comunicaciones** en grid 2 columnas
- Agrupar EarningsCard + EmailStatsCard lado a lado en desktop
- En movil: stack vertical, cards mas compactas con menos padding

**Seccion 4 - Configuracion** (colapsable)
- OfficeHoursConfig + SignatureUpload juntos en un grupo visual con titulo "Configuracion"
- EmailTrendsChart debajo

**Seccion 5 - Historial**
- EmailHistoryCard + FundHoldsCard al final

### 2. DoctorDashboardHeader optimizacion movil
- Reducir margen inferior en movil
- Badges mas compactos, inline

### 3. DoctorStatsGrid movil
- Cambiar de grid 2 columnas a scroll horizontal (`flex overflow-x-auto snap-x`) en movil para evitar cards cortadas
- Cada stat card: ancho minimo fijo (`min-w-[140px]`), snap behavior
- En desktop/tablet mantener el grid actual

## Cambios en `/doctor/earnings` (`DoctorEarnings.tsx`)

### 1. Header movil
- Titulo mas compacto en movil (`text-xl` en lugar de `text-2xl`)
- Subtitulo oculto en movil para ahorrar espacio

### 2. Summary Cards (4 cards de metricas)
- En movil: 2x2 grid con padding reducido (`p-2.5`), texto mas grande para las cifras
- Quitar iconos en movil para ahorrar espacio, solo color de fondo diferencia

### 3. Chart + Breakdown section
- En movil: chart primero a full width, breakdown debajo como row horizontal con 3 items lado a lado
- Chart height reducido en movil (160px vs 250px desktop)
- Breakdown "Por Tipo": cambiar de cards verticales a items compactos horizontales en movil

### 4. Transaction History movil
- Cada transaccion: layout mas compacto, fecha en una linea, monto alineado a derecha
- Badge de tipo inline con la fecha en lugar de debajo
- Eliminar padding excesivo en cada row

### 5. Payout History movil
- Misma optimizacion que Transaction History
- Agrupar status badge + method badge en una linea

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/DoctorDashboard.tsx` | Reorganizar layout con secciones, scroll horizontal stats en movil |
| `src/components/doctor/DoctorStatsGrid.tsx` | Scroll horizontal en movil, snap scroll |
| `src/components/doctor/DoctorQuickActions.tsx` | Padding reducido movil, grid responsive mejorado |
| `src/components/doctor/DoctorDashboardHeader.tsx` | Compactar en movil |
| `src/pages/DoctorEarnings.tsx` | Layout responsivo mejorado para todas las secciones |
| `src/components/doctor/EarningsCard.tsx` | Padding reducido, layout compacto movil |

## Detalles tecnicos

- Se usara `overflow-x-auto`, `snap-x`, `snap-center` para el scroll horizontal del stats grid en movil
- Breakpoints: movil (<640px), tablet (640-1024px), desktop (>1024px)
- Sin agregar nuevas dependencias
- Sin cambiar logica de datos ni funcionalidad

