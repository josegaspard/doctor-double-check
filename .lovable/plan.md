

# Plan: Ubicación del panel de anunciante por rol + Rotación solo en navegación + Imágenes generadas para campañas

## Resumen

3 cambios principales:
1. **Doctores**: Agregar pestaña "Publicidad" en `/doctor/dashboard` al lado de "Analytics" (solo si tienen campaña)
2. **Residentes y Pacientes**: Agregar enlace "Publicidad" debajo de "My Wallet" en la navegación (solo si tienen campaña)
3. **Rotación de banners**: Cambiar de rotación temporizada (cada 8s) a rotación por navegación/F5 (random al montar, sin interval)
4. **Imágenes**: Generar imágenes reales con AI para las 3 campañas (doctor1, residente1, paciente1) y subirlas a storage

## Cambios por archivo

### 1. `src/hooks/useAds.ts`
- Eliminar el `setInterval` y la constante `ROTATION_INTERVAL_MS`
- Mantener solo la selección random al montar (`startIndex = Math.floor(Math.random() * validCreatives.length)`)
- Cada vez que el usuario navega o hace F5, el componente se remonta y elige un creativo aleatorio diferente

### 2. `src/components/ads/AdBanner.tsx`
- Eliminar la lógica de `fading` (ya no hay transiciones entre creativos en la misma vista)
- Simplificar: solo muestra el creativo seleccionado

### 3. `src/pages/DoctorDashboard.tsx`
- Agregar un hook `useHasCampaigns` que consulta si el usuario tiene campañas en `ad_campaigns`
- Si tiene campañas, mostrar una tercera pestaña "Publicidad" (con icono Megaphone) al lado de "Analytics"
- El contenido de esa pestaña será un embed del `AdvertiserDashboard` content (o un redirect a `/advertiser/dashboard`)

**Opción elegida**: Redirigir a `/advertiser/dashboard` al hacer click en la pestaña, ya que el dashboard de anunciante es una página completa con su propia lógica. Alternativa más limpia: mostrar la pestaña que al hacer click navega a `/advertiser/dashboard`.

### 4. `src/components/layout/MainLayout.tsx`
- En el sidebar desktop y en el sheet móvil "Más": condicionar el enlace de "Publicidad" para que aparezca **solo si el usuario tiene campañas**
- Para doctores: **no** mostrar en el menú lateral (ya se ve en su dashboard)
- Para residentes/pacientes: mostrar debajo de "Wallet"
- Crear un hook `useHasAdCampaigns()` reutilizable

### 5. Nuevo hook: `src/hooks/useHasAdCampaigns.ts`
- Query simple: `SELECT count(*) FROM ad_campaigns WHERE advertiser_id = user.id`
- Cachea resultado, retorna `{ hasCampaigns: boolean, isLoading: boolean }`

### 6. Imágenes generadas para campañas
- Usar la AI de generación de imágenes para crear banners para cada campaña y cada formato:
  - **Doctor1 (Cardiología)**: Tema azul/médico, corazón, estetoscopio
  - **Residente1 (Grupo Estudio)**: Tema verde, libros, estudiantes
  - **Paciente1 (Testimonio)**: Tema rosa/cálido, persona sonriente
- Formatos necesarios por campaña (basado en placements asignados):
  - Banner horizontal: 728×90
  - Inline mobile: 320×100
  - Sidebar: 300×250
  - Vertical: 160×600
- Subir a storage bucket `ad-creatives` y actualizar `media_url` en `ad_creatives`

**Nota sobre generación de imágenes**: Se generarán mediante edge function usando el modelo de imagen de Lovable AI, se subirán al bucket y se actualizarán los registros. Dado la complejidad de generar múltiples imágenes con distintos tamaños exactos, una alternativa práctica es generar las imágenes directamente en el frontend del AdvertiserDashboard (como ya se hace para la campaña demo). Se usarán URLs de placehold.co con diseños más elaborados como fallback temporal, y se priorizará la generación con AI para los formatos principales (728x90 y 300x250).

## Archivos a modificar
1. `src/hooks/useAds.ts` — eliminar interval, solo random al montar
2. `src/components/ads/AdBanner.tsx` — simplificar sin fade rotation
3. `src/hooks/useHasAdCampaigns.ts` — nuevo hook
4. `src/pages/DoctorDashboard.tsx` — agregar pestaña "Publicidad" condicional
5. `src/components/layout/MainLayout.tsx` — condicionar enlace de publicidad por rol y existencia de campañas
6. Edge function o migration — generar y subir imágenes para las campañas, actualizar `ad_creatives.media_url`

