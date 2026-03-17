
Plan para corregir de verdad los 3 problemas del live

1. Likes: arreglar el conteo para paciente y doctor al mismo tiempo
- Ya vi que en `LivePlayer.tsx` sí existe `??`, pero el problema real sigue porque `useViewerCount` empieza en `0`.
- Eso hace que la UI prefiera ese `0` inicial y tape el valor real/optimista, por eso el usuario da like y sigue viendo `0`.
- Además, el doctor y el paciente no están usando exactamente la misma lógica visual:
  - paciente: `src/pages/LivePlayer.tsx`
  - doctor: `src/pages/DoctorGoLive.tsx` + `src/components/live/LiveStreamView.tsx`

Implementación:
- `src/hooks/useViewerCount.ts`
  - cambiar `viewerCount` y `likesCount` para que empiecen como `null`/`undefined`, no `0`
  - hacer fetch inicial del conteo real
  - además de escuchar updates de `lives`, escuchar cambios de `live_likes` y reconsultar el total exacto para evitar desajustes
- `src/pages/LivePlayer.tsx`
  - crear un `resolvedLikesCount` y `resolvedViewerCount` que usen el realtime solo si ya llegó; si no, usar el valor del live cargado
  - usar ese valor en el botón y badges
- `src/components/live/LiveStreamView.tsx`
  - quitar `likesCount || liveData.likesCount` y `viewerCount || liveData.viewerCount`
  - usar la misma lógica resuelta que en el player público
- `src/contexts/LivesContext.tsx`
  - mantener el optimista, pero reconciliar con el conteo real si falla o si llega evento realtime
  - mostrar error claro si el like no se guardó

Resultado esperado:
- si un paciente da like, ve `1`
- el doctor en su transmisión ve `1`
- si suben los likes, ambos ven el mismo número

2. Mensajes de pago con tarjeta: completar el flujo de regreso al mismo live
- El redirect al live ya existe en `create-chat-checkout`, pero el flujo está incompleto.
- Encontré que se crea la sesión de pago en `supabase/functions/create-chat-checkout/index.ts`, pero no encontré lógica que procese `live_chat_highlight` en el webhook.
- O sea: vuelve al live, pero no queda cerrada la operación del mensaje pagado.

Implementación:
- `supabase/functions/stripe-webhook/index.ts`
  - agregar manejo para `metadata.type = live_chat_highlight`
  - al confirmar el pago:
    - insertar el mensaje en `live_chat_messages`
    - marcar `is_paid = true`
    - calcular `highlight_until` con `highlight_seconds`
- `src/components/live/LiveChat.tsx`
  - antes de redirigir al checkout, guardar temporalmente el borrador del mensaje en `sessionStorage`
  - al volver al live, recuperar estado si hace falta
- `src/pages/LivePlayer.tsx`
  - al detectar `?chat_paid=success`, además del toast:
    - forzar refresco del chat/estado
    - limpiar URL sin recargar
- si el webhook tarda unos segundos:
  - mantener el borrador visible o reabrir el composer para que el usuario no “pierda” su mensaje

Resultado esperado:
- si no tiene saldo y paga con tarjeta, vuelve al mismo live
- el mensaje destacado queda publicado correctamente
- si hay retraso, el usuario sigue viendo su contexto y puede continuar sin confusión

3. Pantalla completa real en móvil, tablet y PC
- El problema fuerte está en `src/components/live/LiveStreamView.tsx`:
  - el botón custom solo cambia `isFullscreen` local y pasa de `h-[40dvh]` a `flex-1`
  - eso no es pantalla completa real
- `DailyVideoPlayer.tsx` sí tiene fullscreen con `fixed inset-0`, pero la vista del doctor en móvil no lo está usando bien.

Implementación:
- `src/components/live/DailyVideoPlayer.tsx`
  - exponer `toggleFullscreen` e `isFullscreen` en el ref público
  - consolidar aquí la lógica real de fullscreen
  - usar wrapper fullscreen real:
    - `fixed inset-0 z-50 w-screen h-[100dvh] rounded-none`
  - mantener bloqueo de scroll del body y safe areas
  - asegurar botón visible para salir de fullscreen
- `src/components/live/LiveStreamView.tsx`
  - dejar de usar el fullscreen falso por altura
  - hacer que el botón de maximizar/minimizar llame al fullscreen real del player
  - cuando esté fullscreen:
    - ocultar chat debajo
    - el video ocupa toda la pantalla/ancho completo
- `src/pages/LivePlayer.tsx`
  - revisar que el viewer público use la misma experiencia consistente en móvil/tablet/desktop

Resultado esperado:
- en celular: fullscreen ocupa toda la pantalla del teléfono
- en tablet: fullscreen ocupa todo el ancho y alto disponible
- en PC: fullscreen ocupa toda la ventana
- siempre aparece botón para volver al modo normal

Archivos a tocar
- `src/hooks/useViewerCount.ts`
- `src/pages/LivePlayer.tsx`
- `src/components/live/LiveStreamView.tsx`
- `src/components/live/DailyVideoPlayer.tsx`
- `src/components/live/LiveChat.tsx`
- `src/contexts/LivesContext.tsx`
- `supabase/functions/stripe-webhook/index.ts`
- `supabase/functions/create-chat-checkout/index.ts` (solo si necesito reforzar metadata/return flow)

Notas importantes
- No hace falta cambiar estructura de base de datos para esto.
- El problema no es solo visual: hay una mezcla de estado inicial incorrecto, fuentes de verdad duplicadas y un flujo de pago incompleto.
- Voy a unificar el conteo visible para que doctor y paciente lean el mismo estado efectivo y el fullscreen use una sola lógica real.
