

# Plan: Rediseño completo del Panel de Publicidad (Advertiser Dashboard)

## Problemas actuales
- Los placements se muestran como checkboxes planos sin contexto visual — el usuario no sabe cómo ni dónde se verá su anuncio
- La carga de archivos y URL se comparte visualmente (ya corregido en código pero el UX sigue confuso)
- No hay separación clara entre secciones: métricas, campañas activas, creación
- La lista de placements es abrumadora (20+ opciones sin categorizar)
- No hay preview visual de dónde aparecerá cada tipo de anuncio

## Cambios

### 1. `src/pages/AdvertiserDashboard.tsx` — Rediseño completo

**Vista principal (lista de campañas):**
- Header con gradient como el Admin Dashboard
- Resumen financiero en cards con iconos: Total invertido, Total gastado, Impresiones totales, Clicks totales, CTR promedio
- Campañas en cards más ricos: barra de progreso de presupuesto, mini-gráfico sparkline de últimos 7 días, status badge prominente
- Botón "Nueva Campaña" como CTA principal

**Formulario de creación — Rediseño con stepper/wizard:**
- Paso visual (no necesariamente un stepper, pero secciones colapsables claras):
  1. **Información básica**: Nombre, presupuesto, fechas (como está pero mejor styled)
  2. **Audiencia**: Checkboxes de roles + idioma con iconos descriptivos
  3. **Ubicaciones**: Categorizar placements en grupos con preview visual:
     - **Banners** (728×90): Mostrar un mini-mockup de dónde aparece (rectángulo horizontal)
     - **Laterales** (160×600, 300×250): Mini-mockup vertical
     - **Interstitial** (1080×1920 / 1920×1080): Mockup de pantalla completa
     - **Pre-roll Video** (1280×720): Mockup de reproductor con overlay
     - **Inline Content** (320×100): Mockup entre cards
  - Cada grupo tiene un header con icono y descripción breve
  - Cada placement muestra un mini-esquema SVG/div de cómo se ve (rectángulo proporcional al aspect ratio con label)

**Vista de detalle de campaña:**
- Mantener estructura actual pero mejorar:
  - Upload de creatives: cada placement seleccionado tiene su propia card independiente con drag & drop zone, input URL propio, preview del archivo subido
  - Separar visualmente cada placement en una card individual para que no haya confusión de que "se comparte"

### 2. Categorización visual de placements

Agrupar los placements en categorías dentro del formulario:

```text
📺 Banners Horizontales
  ├─ Lives - Banner Superior (728×90)
  ├─ Grabaciones - Banner Superior (728×90)
  ├─ Noticias - Banner Superior (728×90)
  ├─ Content Bottom Banner (728×90)
  └─ Content Mid Inline (728×90)

📱 Inline & Móvil
  ├─ Contenido - Inline (728×90)
  ├─ Noticias - Inline Móvil (320×100)

📐 Barras Laterales
  ├─ Noticias - Lateral (300×250)
  ├─ Noticias - Lateral Izquierdo (160×600)
  ├─ Noticias - Lateral Derecho (160×600)
  ├─ Content Sidebar Left (160×600)
  └─ Content Sidebar Right (160×600)

🖥️ Pantalla Completa (Interstitial)
  ├─ Lives - Interstitial Fullscreen (1080×1920)
  ├─ Lives - Interstitial Mobile (1080×1920)
  └─ Lives - Interstitial Desktop (1920×1080)

🎬 Video Pre-roll
  ├─ Live - Pre-roll Video (1280×720)
  └─ Recording - Pre-roll Video (1280×720)
```

Cada categoría tiene un mini-diagrama SVG inline mostrando la proporción del ad (rectángulo azul con label dentro) para que el usuario entienda visualmente dónde aparece.

### 3. Upload de creatives — Card individual por placement

En la vista de detalle de campaña, cada placement tiene su propia card con:
- Mini preview del formato (rectángulo proporcional)
- Zona de drag & drop independiente
- Input URL independiente (ya corregido con `clickUrls[pl.id]`)
- Preview del archivo subido con botón de eliminar
- Estado claro: "Sin creative" / "Creative activo"

### 4. i18n — Nuevas keys

**es.ts:**
- `ads.placementCategories.banners`: "Banners Horizontales"
- `ads.placementCategories.inline`: "Inline y Móvil"
- `ads.placementCategories.sidebar`: "Barras Laterales"
- `ads.placementCategories.interstitial`: "Pantalla Completa"
- `ads.placementCategories.preroll`: "Video Pre-roll"
- `ads.placementPreview`: "Vista previa de ubicación"
- `ads.noCreativeYet`: "Sin creative asignado"
- `ads.dragOrClickUpload`: "Arrastra un archivo aquí o haz clic"
- `ads.totalInvested`: "Total invertido"
- `ads.avgCTR`: "CTR promedio"

**en.ts:** Traducciones correspondientes

## Archivos a modificar
1. `src/pages/AdvertiserDashboard.tsx` — rediseño completo del dashboard
2. `src/lib/i18n/es.ts` — nuevas keys
3. `src/lib/i18n/en.ts` — nuevas keys

