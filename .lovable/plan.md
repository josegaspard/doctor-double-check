

# Plan: Nuevos formatos publicitarios — Interstitial pantalla completa + Pre-roll video estilo YouTube

## Resumen

Crear dos nuevos formatos de publicidad:
1. **Interstitial fullscreen** (como Rappi): aparece al entrar a `/lives`, dura 3 segundos con auto-cierre + botón X
2. **Pre-roll video** (estilo YouTube): se muestra antes del live en `/live/:id` con contador y botón "Saltar" después de 6 segundos

Ambos formatos se integran al sistema de ads existente (ad_placements, ad_creatives, ad_campaigns, ad_events) con tracking de impresiones/clicks.

---

## Cambios en Base de Datos (migración SQL)

### Nuevos placements
```sql
INSERT INTO public.ad_placements (name, display_name, description, width, height, format, is_active, sort_order) VALUES
  ('lives_interstitial', 'Lives - Interstitial Fullscreen', 'Pantalla completa al entrar a Lives', 1080, 1920, 'interstitial', true, 10),
  ('live_preroll', 'Live - Pre-roll Video', 'Video antes del live estilo YouTube', 1280, 720, 'preroll', true, 11);
```

### Nuevos creatives vinculados a la campaña demo existente
- **Interstitial**: Subir la imagen KFC/Rappi del usuario al bucket `ad-creatives` y crear creative con `media_type: 'image'`
- **Pre-roll**: Subir el video Advil del usuario al bucket `ad-creatives` y crear creative con `media_type: 'video'`
- Ambos vinculados a `campaign_id = 'a0000000-0000-0000-0000-000000000001'` (campaña demo activa)

---

## Nuevos Componentes

### 1. `src/components/ads/AdInterstitial.tsx` — Pantalla completa (3 segundos)
- Overlay `fixed inset-0 z-50` con fondo de la imagen/video del creative
- Botón X en esquina superior derecha (siempre visible)
- Barra de progreso animada de 3 segundos en la parte inferior
- Auto-cierra después de 3 segundos
- Badge "Publicidad" sutil (como en la imagen de referencia)
- Click en el contenido abre `click_url` en nueva pestaña + trackClick
- Usa `useAdCreative('lives_interstitial')` para obtener el creative
- `sessionStorage` flag para mostrar solo 1 vez por sesión (no repetir al navegar)
- Responsive: en mobile ocupa toda la pantalla, en desktop se centra con max-width
- Tracking: impresión al montar, click al tocar el contenido

### 2. `src/components/ads/AdPreroll.tsx` — Pre-roll video estilo YouTube
- Overlay sobre el área del video player en LivePlayer
- Reproduce el video del creative
- Muestra "Publicidad · X segundos" con contador decreciente
- Después de 6 segundos aparece botón "Saltar ▶" / "Skip Ad ▶"
- Si el usuario no salta, el video termina y se cierra solo
- Mientras tanto el live se conecta en segundo plano (ya lo hace)
- Badge "Publicidad" visible durante toda la reproducción
- Barra de progreso del video
- Responsive: mismo aspect-ratio que el video player
- Tracking: impresión al montar, click si toca el video

---

## Integración en Páginas

### `src/pages/LivesGrid.tsx`
- Importar `AdInterstitial`
- Montar el componente al inicio del render (se auto-gestiona con sessionStorage)
- Solo se muestra si hay un creative activo para `lives_interstitial`

### `src/pages/LivePlayer.tsx`
- Importar `AdPreroll`
- Estado `prerollDone` (default false)
- Mientras `!prerollDone`, mostrar `AdPreroll` sobre el área del video
- El Daily viewer token se resuelve en paralelo (ya funciona así)
- Cuando el preroll termina/se salta → `setPrerollDone(true)` → muestra el live

---

## i18n

### `src/lib/i18n/es.ts` — Nuevas keys
```
ads.skipAd: 'Saltar'
ads.adCountdown: 'Publicidad · {seconds}s'
ads.adEndsIn: 'El anuncio termina en {seconds}s'
ads.closeAd: 'Cerrar'
```

### `src/lib/i18n/en.ts` — Traducciones
```
ads.skipAd: 'Skip'
ads.adCountdown: 'Ad · {seconds}s'
ads.adEndsIn: 'Ad ends in {seconds}s'
ads.closeAd: 'Close'
```

---

## Archivos a crear/modificar
1. **Migración SQL** — nuevos placements + creatives + subir archivos al storage
2. `src/components/ads/AdInterstitial.tsx` — **nuevo** componente fullscreen
3. `src/components/ads/AdPreroll.tsx` — **nuevo** componente pre-roll video
4. `src/pages/LivesGrid.tsx` — montar AdInterstitial
5. `src/pages/LivePlayer.tsx` — montar AdPreroll antes del video
6. `src/lib/i18n/es.ts` — nuevas keys de ads
7. `src/lib/i18n/en.ts` — nuevas keys de ads

## Archivos multimedia
- Copiar imagen KFC al proyecto y subirla al bucket `ad-creatives`
- Copiar video Advil al proyecto y subirlo al bucket `ad-creatives`

