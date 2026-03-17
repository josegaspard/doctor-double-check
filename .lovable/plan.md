
Problema real, ya aislado:

1. El flujo del doctor y el flujo del espectador NO usan el mismo fullscreen.
- Doctor: `src/components/live/LiveStreamView.tsx` usa `mobileFullscreen`.
- Espectador: `src/pages/LivePlayer.tsx` renderiza `DailyVideoPlayer` directo y NO usa ese overlay.
- Resultado: tú ves “el mismo error” porque la corrección anterior no cubrió el reproductor del espectador.

2. `DailyVideoPlayer.tsx` está forzando el video a `object-cover` en móvil:
```ts
isMobileDevice ? 'w-full h-full object-cover absolute inset-0'
```
Eso recorta brutalmente un video vertical cuando entra en fullscreen horizontal. Por eso se ve la cara cortada/gigante.

3. El fullscreen actual mezcla dos responsabilidades:
- ocupar toda la pantalla
- decidir cómo escalar el video
Y eso debe separarse.

Do I know what the issue is?
Sí. El problema exacto es:
- el espectador sigue usando un fullscreen distinto al del doctor
- y además el video vertical se está pintando con `object-cover`, cuando debe mostrarse como vertical completo dentro de un canvas horizontal tipo videollamada.

Plan de corrección:

1. Unificar el fullscreen móvil para ambos casos
- Crear un modo fullscreen móvil compartido que use el mismo overlay global tanto para:
  - `src/pages/LivePlayer.tsx` (espectadores)
  - `src/components/live/LiveStreamView.tsx` (doctor)
- El overlay será el único responsable de ocupar toda la pantalla física en celular.

2. Sacar el fullscreen móvil fuera de `DailyVideoPlayer`
- `DailyVideoPlayer.tsx` dejará de “inventar” fullscreen CSS propio en móvil.
- Mantendrá fullscreen nativo solo para desktop/tablet.
- En celular, el padre controlará el overlay y el player solo renderizará el video.

3. Corregir el render del video vertical
- En `DailyVideoPlayer.tsx`, detectar orientación real del track (`videoWidth` vs `videoHeight`).
- Si el video es vertical:
  - usar `object-contain`
  - fondo negro
  - centrar el video completo
- Si el video es horizontal:
  - mantener `object-cover`
- Así:
  - en live móvil fullscreen se verá vertical completo
  - en grabaciones seguirá viéndose vertical como ya lo tienes resuelto

4. Hacer fullscreen móvil tipo YouTube/videollamada
- En `src/index.css`, reemplazar la clase actual por una capa fullscreen robusta:
  - `fixed inset-0`
  - fondo negro total
  - rotación/centrado solo cuando el teléfono siga en portrait
  - ancho y alto físicos completos
- Los controles flotarán encima del overlay, no dentro de un layout parcial de la página.

5. Aplicar esto también al espectador
- En `src/pages/LivePlayer.tsx`, envolver `DailyVideoPlayer` con el mismo overlay fullscreen móvil.
- Así el viewer tendrá:
  - ancho completo
  - alto completo
  - sin ver la página detrás
  - con el video vertical completo dentro del marco horizontal

6. Mantener lo ya correcto
- No tocar la lógica de grabaciones verticales.
- No cambiar desktop/tablet.
- No romper screen share ni audio viewer.

Archivos a tocar:
- `src/pages/LivePlayer.tsx`
- `src/components/live/LiveStreamView.tsx`
- `src/components/live/DailyVideoPlayer.tsx`
- `src/index.css`

Resultado esperado:
- Espectador en celular: fullscreen horizontal real, ocupando toda la pantalla, sin página visible detrás.
- Si el live del doctor es vertical, se verá vertical completo dentro del fullscreen horizontal, estilo videollamada.
- Doctor en celular: mismo comportamiento consistente.
- Grabaciones verticales: permanecen correctas.
