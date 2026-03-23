

# Plan: Separar formatos de publicidad — Video solo en contenido premium, Interstitial solo imágenes + 6 segundos

## Problemas
1. **AdInterstitial** (pantalla de inicio) acepta video — solo debe aceptar imágenes
2. **AdPreroll** (video pre-roll) se muestra en Lives — solo debe mostrarse en grabaciones premium (`RecordingPlayer`)
3. **AdInterstitial** dura solo 3 segundos — debe durar 6 segundos
4. La imagen del interstitial es pequeña (`sm:max-w-md`) — debe ser más grande

## Cambios

### 1. `src/components/ads/AdInterstitial.tsx`
- Cambiar `DURATION_MS` de `3000` a `6000` (6 segundos)
- Eliminar el soporte de video: quitar el bloque `creative.media_type === 'video'` y solo renderizar `<img>`
- Si el creative cargado es de tipo video, ignorarlo (no mostrar el interstitial)
- Hacer la imagen más grande: cambiar `sm:max-w-md` → `sm:max-w-2xl lg:max-w-4xl` para que ocupe más pantalla

### 2. `src/pages/LivePlayer.tsx`
- **Eliminar** el `AdPreroll` del LivePlayer — los lives NO deben tener pre-roll de video
- Quitar el import de `AdPreroll`
- Quitar el estado `prerollDone` o dejarlo siempre en `true`
- El live debe cargar directamente sin publicidad de video

### 3. `src/pages/RecordingPlayer.tsx`
- **Mantener** el `AdPreroll` como está — este es el único lugar donde debe aparecer el pre-roll de video

## Archivos a modificar
1. `src/components/ads/AdInterstitial.tsx` — solo imágenes, 6 segundos, imagen más grande
2. `src/pages/LivePlayer.tsx` — quitar AdPreroll

