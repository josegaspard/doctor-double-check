

# Plan: Optimización de rendimiento de carga

## Diagnóstico

Tras revisar el código, identifiqué estos cuellos de botella principales:

### 1. SplashScreen bloquea 2.3 segundos
El splash tiene un timer fijo de 1800ms + 500ms fade. El usuario ve una pantalla de carga incluso si la app ya cargó. En móvil esto se suma al tiempo de red.

### 2. LivesContext carga TODO al montar
`LivesProvider` está en el árbol raíz (envuelve todas las rutas). Al montarse, hace 3 queries simultáneas: `lives`, `recordings` (TODAS), y `live_likes`. Si el usuario va a `/settings` o `/wallet`, igual descarga todas las grabaciones.

### 3. Recordings se cargan sin paginación
`fetchRecordings` trae TODAS las grabaciones + hace queries adicionales para thumbnails de lives vinculados. A medida que crece la base de datos, esto empeora.

### 4. LivePreviewPlayer crea conexiones Daily.co pesadas
Cada tarjeta de live activo crea un `DailyIframe.createCallObject()` (max 4). Esto descarga el SDK de Daily (~200KB+) e inicia conexiones WebRTC solo para mostrar una preview.

---

## Solución (sin romper funcionalidades)

### A. Reducir SplashScreen a ~1 segundo
**`src/components/SplashScreen.tsx`** + **`src/App.tsx`**
- Reducir timer de 1800ms → 800ms, fade de 500ms → 300ms
- Total: ~1.1s en vez de 2.3s
- La animación se mantiene, solo más rápida

### B. Lazy-load recordings en LivesContext
**`src/contexts/LivesContext.tsx`**
- NO cargar recordings en el `loadData()` inicial
- Solo cargar recordings cuando se llame `refreshRecordings()` o cuando se acceda a `/recordings` o `/recording/:id`
- Agregar un flag `recordingsLoaded` para evitar re-fetch innecesario
- Lives y liked lives se siguen cargando al inicio (son necesarios para el badge de lives activos)

### C. Diferir carga de LivePreviewPlayer con lazy import
**`src/pages/LivesGrid.tsx`**
- El import de `@daily-co/daily-js` (~200KB) se carga solo cuando hay lives activos
- Usar `React.lazy` para `LivePreviewPlayer` y mostrar thumbnail estático mientras carga
- Si no hay lives activos, el SDK de Daily nunca se descarga

### D. Prefetch de rutas probables
**`src/App.tsx`**
- Agregar prefetch de las rutas más visitadas después del primer render idle
- Usar `requestIdleCallback` para precargar chunks de `LivesGrid`, `RecordingsGrid`, `Doctors` durante tiempo muerto del navegador

### E. Optimizar bundle de iconos
**`src/components/layout/MainLayout.tsx`** (704 líneas)
- MainLayout importa ~30 iconos de lucide-react. Con tree-shaking esto ya es eficiente, pero el archivo en sí es grande
- Separar las secciones del menú "More" en un componente lazy (el sheet del menú expandido)

---

## Archivos a modificar

1. `src/components/SplashScreen.tsx` — Reducir timers
2. `src/contexts/LivesContext.tsx` — Lazy-load recordings
3. `src/pages/LivesGrid.tsx` — Lazy import de LivePreviewPlayer
4. `src/pages/RecordingsGrid.tsx` — Trigger `refreshRecordings` al montar
5. `src/App.tsx` — Prefetch idle de rutas populares

## Impacto estimado
- **Tiempo hasta interactivo**: -1.5s (splash + defer recordings)
- **Datos de red iniciales**: -40-60% (no descarga recordings hasta necesario)
- **Móvil**: Mejora significativa al no cargar Daily SDK ni recordings innecesariamente

