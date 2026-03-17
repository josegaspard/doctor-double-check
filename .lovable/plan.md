
Problema real aislado:

Do I know what the issue is?
Sí.

El blanco al iniciar el live en celular no parece venir del backend ni de la creación de la sala. El problema más probable está en el render móvil del emisor:

1. `DoctorGoLive.tsx` detecta móvil de forma inmediata con `window.matchMedia(...)`.
2. Pero `LiveStreamView.tsx` usa `useIsMobile()`, que al primer render devuelve `false` y recién luego cambia a `true`.
3. Eso hace que en celular el componente monte primero la versión desktop del player y, milisegundos después, la desmonte para montar la versión mobile.
4. `DailyVideoPlayer.tsx` destruye cualquier instancia previa de Daily al montar/desmontar.
5. En móvil, ese “doble montaje + destroy + recreate” al arrancar la transmisión puede dejar la vista en blanco justo al comenzar.

Además hay un segundo factor:
- `LiveStreamView.tsx` en móvil renderiza dos layouts totalmente distintos según `isMobile`, en vez de mantener un solo `DailyVideoPlayer` estable.
- Para video en vivo, eso es frágil.

Qué voy a corregir:

1. Estabilizar la detección móvil
- Haré que `LiveStreamView` no dependa de un `useIsMobile()` que cambia después del primer render para decidir entre desktop/mobile.
- Usaré una detección síncrona estable desde el inicio, o pasaré el valor desde `DoctorGoLive` como prop ya resuelto.

2. Evitar que el player se desmonte al iniciar
- Reestructuraré `LiveStreamView.tsx` para que el `DailyVideoPlayer` se monte una sola vez.
- El layout móvil/desktop cambiará por contenedores y clases, no reemplazando el árbol completo del reproductor.

3. Separar “layout” de “sesión de video”
- `DailyVideoPlayer.tsx` seguirá controlando la sesión Daily.
- `LiveStreamView.tsx` solo controlará overlays, chat, botones y fullscreen.
- Así evitamos destruir la llamada solo por un cambio de UI responsiva.

4. Revisar el estado inicial de fullscreen móvil
- Validaré que la capa `fixed inset-0` y `mobile-live-fullscreen` no estén tapando el player antes de que haya video.
- Si hace falta, haré que fullscreen móvil solo se active explícitamente al tocar el botón, nunca al iniciar el live.

5. Mantener intacto lo que ya funciona
- No tocaré grabaciones verticales.
- No cambiaré el comportamiento del viewer más de lo necesario para no romperlo.
- El foco será arreglar primero el flujo del doctor que inicia live desde celular.

Archivos a tocar:
- `src/components/live/LiveStreamView.tsx`
- `src/hooks/use-mobile.tsx` o pasar `isMobile` estable desde `src/pages/DoctorGoLive.tsx`
- `src/pages/DoctorGoLive.tsx`
- `src/components/live/DailyVideoPlayer.tsx` solo si hace falta reducir destrucciones innecesarias

Resultado esperado:
- Al iniciar un live desde celular, ya no aparecerá pantalla blanca.
- El doctor entrará directo a la vista de transmisión.
- El reproductor no se desmontará/recreará por un cambio tardío entre layout desktop y mobile.
