

## Plan: Doctor Mobile Fullscreen en Vertical + Grabación Adaptativa

### Problema actual
Cuando el doctor pone pantalla completa en celular, se usa `.mobile-live-fullscreen` que **rota a landscape**. Pero el doctor debe ver pantalla completa **vertical** (alto completo), estilo videollamada, con botones abajo.

### Cambios

**1. `src/index.css` — Nueva clase para doctor fullscreen vertical**
- Crear `.mobile-doctor-fullscreen`: `fixed inset-0, z-9999, 100dvh height, bg-black` — SIN rotación landscape.
- Mantener `.mobile-live-fullscreen` con rotación landscape solo para viewers.

**2. `src/components/live/LiveStreamView.tsx` — Usar clase vertical para doctor**
- Cambiar el wrapper de `mobile-live-fullscreen` a `mobile-doctor-fullscreen` en la línea 167.
- En fullscreen, el video ocupará alto completo en portrait, los botones se posicionan abajo como videollamada.
- La vista será: video centrado con `object-contain`, fondo negro, botones flotantes abajo.

**3. `src/components/live/DailyVideoPlayer.tsx` — Sin cambios necesarios**
- Ya usa `object-contain` que es correcto para portrait.

**4. Grabaciones — Ya funciona correctamente**
- `useLocalRecording.ts` captura las dimensiones reales del video (`videoWidth`/`videoHeight`). Si el doctor transmite sin fullscreen, la cámara da 1280x720 (horizontal). Si activa fullscreen portrait, el canvas captura el tamaño real del track de la cámara frontal, que en portrait es vertical.
- El reproductor de grabaciones ya usa pillarboxing con `object-contain`.

### Resultado
- Doctor fullscreen en celular: alto completo, vertical, estilo videollamada.
- Viewer fullscreen: sigue siendo landscape horizontal (sin cambios).
- Grabaciones: reflejan la orientación real del stream capturado.

