
Problemas reales detectados y plan de corrección:

1. Likes en live siguen en 0
- Ya confirmé la causa principal en backend: el proyecto tiene DOS triggers activos sobre `public.live_likes`:
  - `on_live_like_change`
  - `trg_update_live_likes_count`
- Eso deja el contador inconsistente y además el live actual tiene evidencia de desajuste:
  - existe 1 registro en `live_likes`
  - pero `lives.likes_count` está en 0
- También hay dos fuentes de verdad en frontend (`live.likesCount` y `useViewerCount`) y el fallback `directLive` complica más la visualización.

Implementación:
- Eliminar el trigger duplicado y dejar solo uno para `update_live_likes_count`.
- Recalcular `likes_count` para todos los lives desde `COUNT(*)` de `live_likes`.
- En frontend, unificar el valor visible:
  - paciente (`LivePlayer.tsx`)
  - doctor (`DoctorGoLive.tsx` / `LiveStreamView.tsx`)
  - ambos deben leer el mismo contador resuelto.
- Mantener actualización optimista, pero reconciliar siempre con realtime/DB para que si el paciente da like, el doctor vea ese mismo número al instante.

Resultado esperado:
- si el paciente da like, se ve 1 en su live
- el doctor ve 1 en su transmisión
- si suben a 2, 3, 4, ambos ven exactamente el mismo número

2. Pantalla completa del viewer se rompe
- El problema no es solo CSS: el viewer público usa `DailyVideoPlayer` directo, pero el doctor móvil usa otra estructura distinta (`LiveStreamView`).
- Además, el wrapper actual de fullscreen no fuerza tamaño completo real en todas las variantes y puede dejar el layout “colapsado”, que coincide con lo que reportas: parece que “se cierra” el live.

Implementación:
- Consolidar fullscreen real dentro de `DailyVideoPlayer` como única fuente:
  - `fixed inset-0 z-[...] w-screen h-[100dvh]`
  - sin depender de layouts exteriores
  - ocultando scroll del body
  - con botón visible para volver al modo normal
- Hacer que tanto viewer como doctor usen la misma lógica real de fullscreen.
- Ajustar también tablet y desktop para que el video ocupe toda la ventana, no solo un bloque más grande.

Resultado esperado:
- paciente/residente: fullscreen completo real
- doctor: fullscreen completo real
- móvil/tablet/PC: mismo comportamiento consistente

3. No malograr screen share del doctor
- Revisando `DailyVideoPlayer.tsx`, la lógica de screen share existe, pero la experiencia puede haberse roto por cambios de fullscreen/wrapper.
- La UI correcta que quieres mantener es:
  - contenido compartido grande
  - cámara del doctor pequeña en una esquina
  - fullscreen mostrando correctamente la pantalla compartida

Implementación:
- Restaurar prioridad visual del screen share:
  - pantalla compartida como capa principal
  - cámara local del doctor como PiP fija en esquina inferior
- Asegurar que esa composición no cambie ni se esconda al entrar en fullscreen.
- Revisar específicamente la clase del video local cuando hay `hasAnyScreenShare` para que no vuelva a ocupar el lienzo completo ni tape lo compartido.

Resultado esperado:
- al compartir pantalla/ventana, se ve grande lo compartido
- la cámara del doctor queda en una esquina
- en fullscreen sigue igual, pero ocupando toda la pantalla

4. Compartir live con iconos reales de redes
- Ahora el modal usa texto/emoji y se siente improvisado.
- También hay warning en consola con `Dialog`, así que revisaré que el modal no esté recibiendo refs o composición incorrecta desde algún wrapper.

Implementación:
- Rehacer el modal de compartir con iconos reales:
  - WhatsApp
  - Facebook
  - X
  - copiar enlace
- Mantener links directos a compartir.
- Opcionalmente usar `navigator.share` en móvil si está disponible, pero sin reemplazar los botones sociales visibles.

Archivos a tocar
- `src/pages/LivePlayer.tsx`
- `src/pages/DoctorGoLive.tsx`
- `src/components/live/DailyVideoPlayer.tsx`
- `src/components/live/LiveStreamView.tsx`
- `src/hooks/useViewerCount.ts`
- `src/contexts/LivesContext.tsx`
- nueva migración para corregir triggers duplicados y recontar likes

Detalles técnicos clave
- Ya confirmé en BD que hay un bug real de infraestructura, no solo de UI:
  - `live_likes` tiene filas
  - `lives.likes_count` no coincide
  - hay trigger duplicado sobre la misma tabla
- La corrección debe ser backend + frontend; solo tocar la UI no lo arregla.
- No voy a cambiar la lógica de monetización del chat en este paso salvo lo necesario para no romper el flujo actual; lo urgente aquí es:
  1) likes sincronizados
  2) fullscreen real
  3) restaurar bien screen share del doctor
  4) modal de compartir con iconos correctos
