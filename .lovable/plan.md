

# Plan: Mejoras mobile en admin pages, sticky sidebar, SEP API, analytics y footer

## Archivos a modificar

### 1. `src/pages/AdminDoctors.tsx` — Card de doctor mobile-friendly
- El card actual usa `flex items-start` horizontal en mobile, causando que contenido se apriete
- Reestructurar para que en mobile todo sea vertical (stacked): avatar + nombre arriba, detalles abajo, botones al fondo
- Reducir padding, mejorar wrapping de badges y metadata (licencia, ubicación, firmas)
- Los botones Aprobar/Rechazar deben ser full-width en mobile
- SEP verification section: más compacta, botones más visibles

### 2. `supabase/functions/verify-cedula-sep/index.ts` — Verificar y mejorar API SEP
- La función actual usa `https://search.sep.gob.mx/solr/cedulasCore/select` que es el endpoint Solr real de la SEP
- Probar si funciona haciendo un test con la edge function tool
- Si no funciona (la SEP cambió su API o bloqueó acceso), implementar alternativa:
  - Opción A: Web scraping de `https://cedulaprofesional.sep.gob.mx/cedula/presidencia/indexAvanzada.action` 
  - Opción B: Usar la API del BUAP/RENAP si existe alternativa pública
- Mantener siempre el fallback manual con enlace directo a `cedulaprofesional.sep.gob.mx`
- Ajustar el `handleVerifyCedula` en AdminDoctors para pasar `userId` correctamente (actualmente pasa `doctor.user_id` pero la función espera el user autenticado)

### 3. `src/pages/AdminRanks.tsx` — Mobile layout
- El card de rango actual tiene `flex items-center justify-between gap-4` que causa overflow en mobile (texto de requisitos se corta)
- Reestructurar: badge y nombre arriba, requisitos en grid 2x2 debajo, botones editar/eliminar al lado del badge
- Reducir texto de requisitos a formato más compacto en mobile

### 4. `src/pages/AdminVerifications.tsx` — Mobile layout
- El card actual tiene `flex items-center gap-4` con avatar + info + 3 botones en línea — se rompe en mobile
- Reestructurar: en mobile, apilar verticalmente (avatar+nombre arriba, email/fecha abajo, botones full-width al fondo)
- Stats cards: reducir padding y font sizes
- Tabs: hacer texto más pequeño, quitar iconos en mobile para que quepan

### 5. `src/pages/AdminAnalytics.tsx` — Mejora completa UX/UI + métricas globales
- **Nuevas métricas a agregar:**
  - Ingresos brutos totales de la plataforma (suma de todas las fuentes)
  - Comisión/ganancias de la plataforma (% retenido después de pagar a doctores)
  - Total pagado a doctores (sum of `total_earnings` from `doctor_profiles`)
  - Total pendiente de pago a doctores (`pending_earnings`)
  - Chats de pago (revenue from paid live chats)
  - Grabaciones vendidas vs total grabaciones
- **Desglose claro:** Separar en secciones con headers: "Ingresos Brutos", "Desglose por Fuente", "Pagos a Médicos", "Ganancia Neta"
- **Tabla mensual:** Agregar columna de ganancia neta de la plataforma
- **Mobile:** La tabla de desglose mensual se corta — convertir a cards apiladas en mobile o hacer scroll horizontal con min-width en columnas
- Mejorar chart labels en mobile (truncar nombres de meses)

### 6. `src/pages/Doctors.tsx` — "Doctores Disponibles Ahora" mobile + sidebar sticky
- **Sidebar sticky:** El layout actual `md:grid md:grid-cols-[14rem_1fr] md:gap-6 md:items-start` con `sticky top-24` debería funcionar. El problema probable es que el main content column no tiene suficiente altura o el padre tiene `overflow: hidden`.
  - Solución: Asegurar que el contenedor padre NO tenga overflow hidden. Agregar `overflow-visible` explícito al grid container.
  - Verificar que `MainLayout` no impone restricciones de overflow.
- **"Doctores Disponibles Ahora" en mobile:** El card es demasiado compacto (200px min-width) y el contenido se aprieta
  - Aumentar min-width a 220px
  - Mejorar layout interno: nombre y especialidad más legibles
  - Precio más visible con mejor formato

### 7. `src/components/layout/UnifiedFooter.tsx` — Centrar columnas en mobile
- El footer app variant usa `grid grid-cols-2 md:grid-cols-4` para las columnas de links
- En mobile (cols-2), las columnas PLATAFORMA y RECURSOS se alinean a la izquierda porque `FooterLinkColumn` no tiene text-center
- Agregar `text-center` al `FooterLinkColumn` y `items-center` al `ul` solo en mobile (via responsive classes)
- Centrar también los headers de columna

## Orden de implementación
1. AdminDoctors (card mobile) + SEP API test
2. AdminRanks (mobile)  
3. AdminVerifications (mobile)
4. AdminAnalytics (métricas completas + mobile)
5. Doctors (sidebar sticky fix + available doctors mobile)
6. UnifiedFooter (centrar en mobile)

