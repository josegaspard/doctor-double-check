

# Plan: Mejorar flujo post-live, banner sticky y persistencia de cámara

## Resumen de cambios

### 1. EndingLiveModal — Rediseñar el flujo de cierre

**Archivo:** `src/components/live/EndingLiveModal.tsx`

- Mostrar **siempre** el revenue de chats de pago en el stage `'done'` (incluso si es $0, mostrar "$0 MXN en chats de pago")
- En el stage `'choose'`:
  - Cambiar el copy a "Guardar como contenido premium" con checkbox marcado por default
  - Un solo botón "Confirmar" que respeta el estado del checkbox
  - El modal NO se puede cerrar (ya tiene `hideClose`) — el doctor DEBE tomar la decisión
- En el stage `'done'`:
  - Agregar un botón "Ver mis grabaciones" que el doctor debe clickear para cerrar
  - Eliminar el `setTimeout` automático de 2.5s — esperar a que el doctor haga clic
  - Pasar `onDismiss` callback como nuevo prop

### 2. DoctorGoLive — Ajustar flujo handleEndLive

**Archivo:** `src/pages/DoctorGoLive.tsx`

- En `handleEndLive`:
  - Eliminar el `await new Promise(setTimeout 2500)` del stage `'done'`
  - En su lugar, esperar a un nuevo resolver (similar a `keepDecisionResolver`) para el stage `'done'`
  - Cuando el doctor clickee "Ver mis grabaciones" en el EndingLiveModal, resolver la promesa
  - Luego navegar a `/doctor/recordings` (siempre, si se guardó) o `/doctor/dashboard` (si no)
  - Mover `setIsLive(false)`, `setLiveData(null)`, `setShowEndingModal(false)` ANTES de `navigate` para evitar pantalla en blanco

### 3. EndingLiveModal + LiveDialogs — Props nuevos

**Archivo:** `src/components/live/EndingLiveModal.tsx`
- Agregar prop `onDismissDone?: () => void` para el botón del stage `'done'`

**Archivo:** `src/components/live/LiveDialogs.tsx`
- Pasar `onDismissDone` a `EndingLiveModal`

### 4. ActiveLiveBanner — Optimizar UX móvil + centrado

**Archivo:** `src/components/live/ActiveLiveBanner.tsx`

- Posición: `fixed bottom-6` (más abajo, arriba de la nav móvil pero no encimada)
- Centrado perfecto con `left-1/2 -translate-x-1/2`
- Ancho responsivo: `w-[calc(100%-1.5rem)] max-w-sm` en móvil
- Agregar `safe-area-inset-bottom` padding
- La cámara sigue grabando porque el `localRecording` y el `MediaStream` viven en el contexto/state del componente `DoctorGoLive` que se desmonta al navegar — PERO el Daily call instance persiste si no se destruye. El `ActiveLiveContext` ya guarda la info de la sala para reconectarse al volver.

### 5. LiveEndedOverlay — Aumentar countdown a 6 segundos y redirigir a /lives

**Archivo:** `src/components/live/LiveEndedOverlay.tsx`

- Cambiar `useState(5)` → `useState(6)` para el countdown
- Ya redirige a `/lives` — solo ajustar el timer

## Nota sobre persistencia de cámara al navegar

El `MediaStream` (cámara/mic) se pierde al desmontar `DoctorGoLive` porque el stream está en state local. El Daily call instance puede persistir si no se destruye, pero la grabación local se interrumpe. **La solución actual** (ActiveLiveContext + banner para volver) es la correcta: el doctor recibe un aviso prominente para volver, y al regresar re-joins la sala. La grabación local ya está corriendo desde que inició. Si navega y vuelve, la grabación de ese segmento se pierde pero el live sigue para los viewers a través de Daily.

## Archivos a modificar
1. `src/components/live/EndingLiveModal.tsx` — Revenue siempre visible, choose con checkbox, done con botón manual
2. `src/pages/DoctorGoLive.tsx` — Quitar timeout, usar resolver para done, fix orden cleanup
3. `src/components/live/LiveDialogs.tsx` — Pasar onDismissDone
4. `src/components/live/ActiveLiveBanner.tsx` — Optimizar UX móvil
5. `src/components/live/LiveEndedOverlay.tsx` — Countdown 6s

