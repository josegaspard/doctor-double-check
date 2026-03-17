
Objetivo: rehacer el fullscreen solo para celular para que funcione como YouTube de verdad: al tocar pantalla completa debe cubrir toda la pantalla física, ocultar el resto de la UI y verse horizontal aunque el teléfono siga en vertical.

Problema real detectado:
- Hoy hay dos lógicas compitiendo:
  1. `DailyVideoPlayer` maneja su propio `isFullscreen`.
  2. `LiveStreamView` también intenta forzar fullscreen leyendo el ref.
- Además, en móvil se está rotando solo el player, no toda la capa fullscreen. Por eso en tu captura queda media pantalla con la página visible y el video “pegado” a un lado.
- `className` externo en `LiveStreamView` también pisa parte del layout interno del player, así que el fallback actual no termina ocupando toda la pantalla.

Plan de corrección:
1. Unificar fullscreen móvil en un solo lugar
- Mover el control de fullscreen móvil a `src/components/live/LiveStreamView.tsx`.
- Crear un estado dedicado como `mobileFullscreen`.
- En celular, el botón de fullscreen ya no dependerá del `isFullscreen` interno del player.

2. Crear una capa fullscreen exclusiva para móvil
- Renderizar una capa fija tipo overlay (`fixed inset-0 z-[9999] bg-black`) solo cuando `mobileFullscreen` esté activo.
- Esa capa contendrá el video completo, controles y badges mínimos.
- El resto de la pantalla móvil (chat, header, contenido debajo) quedará oculto mientras esté activo.

3. Rotar la capa completa, no solo el video
- Aplicar la rotación horizontal al contenedor fullscreen móvil completo.
- En portrait, centrar la capa rotada con una estrategia robusta tipo:
  - `top: 50%`
  - `left: 50%`
  - `transform: translate(-50%, -50%) rotate(90deg)`
  - `width: 100dvh`
  - `height: 100vw`
- Esto evita el efecto actual de “video cortado a un lado”.

4. Mantener comportamiento nativo solo para desktop/tablet
- `src/components/live/DailyVideoPlayer.tsx` seguirá usando fullscreen nativo/callback para desktop y demás casos.
- En móvil, si recibe el modo externo, no intentará manejar fullscreen por su cuenta.
- Así evitamos que las dos implementaciones vuelvan a pelear entre sí.

5. Bloqueo de orientación y limpieza
- Al entrar en fullscreen móvil:
  - intentar `screen.orientation.lock('landscape')`
  - bloquear scroll en `html/body`
- Al salir:
  - `screen.orientation.unlock()`
  - restaurar scroll
- Esto asegura salida limpia en iPhone y Android.

6. CSS dedicado para móvil
- Ajustar `src/index.css` para una clase nueva más específica, por ejemplo `mobile-live-fullscreen`.
- Esa clase solo aplicará en móvil/portrait y controlará:
  - tamaño
  - centramiento
  - rotación
  - safe areas
  - fondo negro total

Archivos a tocar:
- `src/components/live/LiveStreamView.tsx`
  - convertir fullscreen móvil en overlay real y fuente única de verdad
- `src/components/live/DailyVideoPlayer.tsx`
  - separar fullscreen móvil externo del fullscreen interno existente
- `src/index.css`
  - nueva utilidad robusta para fullscreen horizontal móvil

Resultado esperado:
- En celular, al tocar pantalla completa:
  - desaparece la UI normal
  - el video ocupa toda la pantalla física
  - se ve horizontal tipo YouTube
  - al salir, vuelve al layout móvil normal
- Desktop y otros dispositivos quedan intactos
