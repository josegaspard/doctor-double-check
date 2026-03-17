

# Plan: Audio del viewer, fullscreen móvil, y prompt de sonido

## Problemas identificados

1. **Sin botón de audio para viewers**: Los controles solo muestran botones para el owner (mic, video, screen share). El viewer no tiene botón para activar/desactivar audio.

2. **Fullscreen no funciona en móvil**: `requestFullscreen()` no funciona en iOS Safari para elementos `div`. El fallback CSS actual no se activa correctamente.

3. **"Toca para activar el sonido" se repite**: La función `updateVideoElements` se llama en CADA evento `participant-updated` (líneas 146-164), y hace `innerHTML = ''` (línea 209) — destruye y recrea TODOS los elementos de video. Cada recreación re-ejecuta la lógica de autoplay y vuelve a mostrar el prompt de unmute.

## Solución

**Archivo: `src/components/live/DailyVideoPlayer.tsx`**

### 1. Botón de audio para viewers
En la barra de controles (línea 486), añadir un botón de volumen cuando `!isOwner`. Este botón ejecutará la misma lógica de `handleUnmute` (desmutear todos los videos/audios) o mutearlos.

Nuevo estado: `viewerAudioMuted` (boolean). El botón alterna entre mutear/desmutear todos los elementos media remotos.

### 2. Fullscreen en móvil
Mejorar `toggleFullscreen` para que cuando `requestFullscreen()` falle (iOS), active el fallback CSS: `fixed inset-0 z-[9999] w-screen h-[100dvh]` con `document.body.style.overflow = 'hidden'`. Ya existe parcialmente pero el fallback no setea las clases correctamente.

### 3. Dejar de re-mostrar el prompt
Añadir un ref `userHasUnmutedRef` que se pone en `true` cuando el usuario toca "activar sonido". En `updateVideoElements`, si `userHasUnmutedRef.current === true`, los nuevos elementos media se crean con `muted = false` directamente y NO se vuelve a mostrar `showUnmutePrompt`.

### Cambios concretos

```
DailyVideoPlayer.tsx:
- Nuevo estado: viewerAudioMuted (default true)
- Nuevo ref: userHasUnmutedRef (default false)
- handleUnmute: setea userHasUnmutedRef = true, viewerAudioMuted = false
- updateVideoElements: si userHasUnmutedRef.current, crear media con muted=false y no setear showUnmutePrompt
- toggleFullscreen: fallback CSS para iOS
- Controles: botón Volume2/VolumeX para !isOwner
```

Solo se modifica `DailyVideoPlayer.tsx`.

