

# Plan: Burbuja flotante de Live + Orientación desde "Chat privado"

## Resumen
Cuando un doctor está transmitiendo y navega a otra página (Chat, Dashboard, etc.), el live continúa en una burbuja flotante en la esquina inferior derecha. Al hacer clic en la burbuja, vuelve a la página completa del live. Para los espectadores, el botón "Chat privado" abre directamente el flujo de reserva de orientación (ya existente) en lugar de redirigir.

---

## Parte 1: Contexto global de streaming activo

**Nuevo archivo: `src/contexts/ActiveStreamContext.tsx`**
- Contexto React que almacena el estado de un live activo del doctor: `liveData`, `roomUrl`, `ownerToken`, `elapsedTime`, `viewerCount`, `likesCount`, `showChat`, `isMinimized` (burbuja), `dailyRoomName`, recording state refs, etc.
- Provee funciones: `setActiveStream(data)`, `clearActiveStream()`, `minimizeStream()`, `maximizeStream()` (navega a `/doctor/go-live`).
- El timer de `elapsedTime` vive aquí para que persista entre navegaciones.
- Se monta en `App.tsx` dentro de `AuthenticatedProviders`, solo para doctores.

## Parte 2: Refactor de DoctorGoLive.tsx

**Archivo: `src/pages/DoctorGoLive.tsx`**
- Al iniciar un live, registrar el stream en `ActiveStreamContext` con todos los datos necesarios.
- Al detectar que ya hay un stream activo en el contexto (ej: doctor vuelve a `/doctor/go-live`), restaurar la vista completa del live desde el contexto en lugar de mostrar el setup form.
- Eliminar el bloqueo de navegación (popstate guard) y en su lugar, al navegar fuera, llamar `minimizeStream()` que activa la burbuja flotante.
- `handleEndLive` limpia el contexto con `clearActiveStream()`.

## Parte 3: Componente de burbuja flotante

**Nuevo archivo: `src/components/live/LiveStreamBubble.tsx`**
- Se renderiza globalmente (en `App.tsx` o `MainLayout`) cuando `isMinimized === true` en el contexto.
- Burbuja de ~180x120px fija en la esquina inferior derecha (`fixed bottom-20 right-4 z-50`), arriba del bottom nav/footer.
- Muestra:
  - Un mini preview de video usando el `<video>` element del Daily call existente (reusa la instancia de DailyCall del contexto, no crea una nueva).
  - Badge "EN VIVO" pulsante con el timer.
  - Botón para expandir/volver al live (navega a `/doctor/go-live` y llama `maximizeStream()`).
  - Botón pequeño para finalizar (abre confirmación).
- Bordes redondeados, sombra, animación de entrada con framer-motion.
- Draggable es opcional (fase futura); por ahora posición fija.

**Reto técnico**: La instancia de DailyCall debe sobrevivir la navegación. Solución: almacenar la referencia al `DailyCall` object en el contexto (un ref), y en la burbuja, renderizar el video track directamente usando `callObject.participants().local.videoTrack`. `DailyVideoPlayer` no se desmonta al minimizar — el call object se preserva en el contexto.

## Parte 4: Integración en App.tsx

**Archivo: `src/App.tsx`**
- Agregar `ActiveStreamProvider` dentro de `AuthenticatedProviders`.
- Renderizar `<LiveStreamBubble />` fuera del `<Routes>` para que persista en todas las páginas.

## Parte 5: Chat Privado abre Orientación (espectadores)

**Archivo: `src/pages/LivePlayer.tsx`**
- Modificar `handleStartPrivateChat` (línea 354): en lugar de buscar sesión existente y redirigir, abrir directamente `setShowBooking(true)` para que el flujo de reserva con mensaje + pago se ejecute.
- Si el usuario ya tiene una sesión activa, redirigir al chat existente (comportamiento actual). Si no, abrir el booking dialog.
- En el `LiveConsultationBooking`, el flujo ya existente maneja: mensaje obligatorio → pago wallet/stripe → envío del mensaje como primer chat → notificación al doctor con contexto "desde su live" → marca en `live_consultation_requests`.

---

## Archivos a crear
- `src/contexts/ActiveStreamContext.tsx`
- `src/components/live/LiveStreamBubble.tsx`

## Archivos a modificar
- `src/App.tsx` — agregar provider y burbuja
- `src/pages/DoctorGoLive.tsx` — refactor para usar contexto global
- `src/pages/LivePlayer.tsx` — cambiar "Chat privado" para abrir booking

