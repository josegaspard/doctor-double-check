

# Plan: Pre-roll ad en grabaciones + Interstitial responsive por dispositivo

## Problema
1. El pre-roll video (Advil) solo se muestra antes de lives, pero NO antes de las grabaciones premium
2. El interstitial muestra la misma imagen en todos los dispositivos — debería mostrar una imagen diferente en móvil vs desktop/tablet

## Cambios

### 1. `src/pages/RecordingPlayer.tsx` — Añadir AdPreroll antes del video de grabación
- Añadir estado `prerollDone` (default `false`)
- Envolver el `RecordingVideoPlayer` con el componente `AdPreroll` como overlay
- Mientras `!prerollDone`, mostrar AdPreroll sobre el área del video
- El video de grabación se carga en segundo plano (el componente ya existe en el DOM, solo está oculto detrás del ad)
- Cuando el preroll termina o se salta → `setPrerollDone(true)` → se revela el video

### 2. `src/components/ads/AdPreroll.tsx` — Aceptar placement configurable
- Cambiar de hardcoded `'live_preroll'` a aceptar prop `placementName` con default `'live_preroll'`
- Esto permite reutilizar el mismo componente tanto en lives como en grabaciones
- Añadir nuevo placement `recording_preroll` en la DB que use el mismo creative de video

### 3. `src/components/ads/AdInterstitial.tsx` — Imagen diferente por dispositivo
- Usar `window.innerWidth` para detectar si es móvil (<768px) o desktop/tablet
- Cargar dos creatives del placement: uno para móvil y otro para desktop
- Alternativamente, crear dos placements separados (`lives_interstitial_mobile`, `lives_interstitial_desktop`) o usar un solo placement con dos creatives y seleccionar por viewport
- Enfoque más simple: guardar la imagen Dell como un segundo creative en el mismo placement, y en el componente seleccionar por viewport en vez de al azar

### 4. Migración SQL — Nuevo placement + creatives
```sql
-- Placement para pre-roll en grabaciones (reutiliza el mismo video Advil)
INSERT INTO ad_placements (name, display_name, description, width, height, format, is_active, sort_order)
VALUES ('recording_preroll', 'Recording - Pre-roll Video', 'Video antes de grabación premium', 1280, 720, 'preroll', true, 12);

-- Creative para recording_preroll vinculado al video Advil existente
-- Creative desktop para interstitial con imagen Dell
```

### 5. Subir imagen Dell al storage
- Copiar la imagen Dell/Qualisys al bucket `ad-creatives`
- Crear creative vinculado al placement `lives_interstitial` con un tag o metadata para identificarlo como desktop

### 6. `src/hooks/useAds.ts` — Selección por viewport
- Modificar `useAdCreative` para aceptar opción `deviceFilter?: 'mobile' | 'desktop'`
- O mejor: en `AdInterstitial`, cargar todos los creatives del placement y seleccionar según viewport
- Enfoque pragmático: añadir campo `device_target` a `ad_creatives` (nullable, 'mobile'|'desktop'|null donde null = todos) y filtrar en el hook

## Enfoque simplificado (sin cambio de schema en ad_creatives)
Para no complicar con campos nuevos en la tabla:
- Crear DOS placements interstitial: `lives_interstitial_mobile` y `lives_interstitial_desktop`
- En `AdInterstitial`, detectar viewport y usar el placement correcto
- Imagen KFC → creative de `lives_interstitial_mobile`
- Imagen Dell → creative de `lives_interstitial_desktop`

## Archivos a crear/modificar
1. **Migración SQL** — nuevos placements (`recording_preroll`, `lives_interstitial_mobile`, `lives_interstitial_desktop`) + creatives
2. `src/pages/RecordingPlayer.tsx` — montar AdPreroll antes del video con estado `prerollDone`
3. `src/components/ads/AdPreroll.tsx` — aceptar `placementName` prop configurable
4. `src/components/ads/AdInterstitial.tsx` — detectar viewport y usar placement mobile vs desktop
5. `src/hooks/useAds.ts` — sin cambios (ya soporta cualquier placement name)
6. Subir imagen Dell al bucket `ad-creatives`

