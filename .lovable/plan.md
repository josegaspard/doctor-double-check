

# Plan: Corregir likes, checkout de chat y pantalla completa en Lives

## 1. Likes no se contabilizan (muestra 0)

**Causa raíz**: Dos problemas combinados:
- En la línea 504 de `LivePlayer.tsx`: `{realtimeLikesCount || live.likesCount}` — el operador `||` trata `0` como falsy, así que si el conteo real es 0 nunca muestra el valor actualizado correctamente.
- Si el live se cargó vía `directLive` (fallback DB), el update optimístico en `LivesContext.setLives` no tiene efecto porque `directLive` es estado local independiente.

**Solución** (`src/pages/LivePlayer.tsx`):
- Cambiar todas las instancias de `realtimeLikesCount || live.likesCount` por `realtimeLikesCount ?? live.likesCount` (nullish coalescing en vez de OR lógico).
- Hacer lo mismo con `viewerCount || live.viewerCount` → `viewerCount ?? live.viewerCount`.
- En `handleLike`, tras el like/unlike exitoso, actualizar también el `directLive` si existe.

**Solución** (`src/contexts/LivesContext.tsx`):
- Agregar toast de error si el insert/delete falla para que el usuario sepa qué ocurrió.

## 2. Stripe checkout para chat de pago — redirigir de vuelta al live

**Problema**: `window.open(data.url, '_blank')` se bloquea como popup en móvil. El usuario paga pero no regresa al live.

**Solución** (`src/components/live/LiveChat.tsx` línea 247):
- Cambiar `window.open(data.url, '_blank')` → `window.location.href = data.url`.
- El `success_url` ya apunta a `/live/${liveId}?chat_paid=success`, así que el usuario regresa automáticamente.

**Solución** (`src/pages/LivePlayer.tsx`):
- Agregar detección del query param `?chat_paid=success` al montar. Mostrar toast de confirmación y limpiar el param de la URL.

## 3. Pantalla completa no funciona correctamente en móvil

**Problema**: `requestFullscreen()` no funciona en iOS Safari para elementos `<div>`. Solo funciona en `<video>` elements. El fallback CSS (`fixed inset-0 z-50`) sí aplica pero `requestFullscreen` falla silenciosamente.

**Solución** (`src/components/live/DailyVideoPlayer.tsx` líneas 351-358):
- Cambiar `toggleFullscreen` para usar solo el enfoque CSS (no llamar a `requestFullscreen`/`exitFullscreen` del API del navegador).
- En vez de depender del `fullscreenchange` event, manejar el estado internamente con `setIsFullscreen`.
- El CSS `fixed inset-0 z-50` ya funciona correctamente en todos los dispositivos — solo necesitamos quitar las llamadas a la Fullscreen API que fallan en iOS.
- Asegurar que en fullscreen se oculte el scroll del body con `document.body.style.overflow`.

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/LivePlayer.tsx` | `||` → `??` para contadores, detectar `?chat_paid=success`, actualizar directLive en handleLike |
| `src/components/live/LiveChat.tsx` | `window.open` → `window.location.href` para Stripe checkout |
| `src/components/live/DailyVideoPlayer.tsx` | Fullscreen CSS-only approach, quitar `requestFullscreen` API |
| `src/contexts/LivesContext.tsx` | Toast de error en like/unlike fallido |

