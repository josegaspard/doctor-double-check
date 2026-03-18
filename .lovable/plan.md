
Objetivo: simplificar por completo el cierre del live para que haya una sola ventana clara, con decisión de guardar/no guardar desde ahí mismo, cierre en segundo plano y salida fluida hacia “Grabaciones”, además de separar las métricas de lives no guardados en un tab “Lives pasados”.

Plan de implementación

1. Unificar el flujo de cierre en una sola ventana
- Reemplazar el flujo actual de 2 modales por un único diálogo de cierre dentro de `src/components/live/LiveDialogs.tsx`.
- Ese diálogo mostrará:
  - título: “¿Finalizar transmisión?”
  - texto simple y grande
  - checkbox: “Guardar este live como contenido premium” (marcado por default)
  - resumen breve de lo que pasará al confirmar
  - 2 botones siempre visibles y clicables:
    - “Continuar transmitiendo”
    - “Finalizar y salir”
- Eliminar la etapa `choose` del `EndingLiveModal`; ya no debe aparecer otra ventana para decidir guardar o no.

2. Corregir la causa de las 2 ventanas y del botón bloqueado
- En `src/components/live/LiveDialogs.tsx`, dejar de usar `AlertDialogAction`/`AlertDialogCancel` para este flujo y usar botones normales controlados por estado.
- Motivo: el comportamiento automático del AlertDialog está cerrando/animando mientras el segundo modal abre, generando superposición y bloqueos visuales.
- Mantener un solo `open` controlado desde `DoctorGoLive.tsx`, con una sola transición.
- `isEnding` solo debe activarse cuando el doctor pulse “Finalizar y salir”, no antes.

3. Guardado en segundo plano + salida inmediata y simple
- En `src/pages/DoctorGoLive.tsx`, cambiar `handleEndLive` para recibir la decisión `saveAsPremium: boolean`.
- Nuevo flujo:
  1. doctor pulsa “Finalizar y salir”
  2. se cierra el diálogo único
  3. el live termina
  4. si eligió guardar, se crea/procesa la grabación en segundo plano
  5. el doctor sale inmediatamente del live y es llevado a `/doctor/recordings`
- Si no eligió guardar:
  - no crear grabación final
  - guardar únicamente las métricas del live terminado
  - llevar al doctor a `/doctor/recordings` pero abrir el tab “Lives pasados”
- Quitar la dependencia de esperar manualmente el modal `done` para navegar.

4. Rediseñar `EndingLiveModal` para que solo muestre progreso
- `src/components/live/EndingLiveModal.tsx` ya no decidirá si guardar o no.
- Quedará solo como modal/progreso no interactivo para estados:
  - `ending`
  - `saving`
  - `uploading`
- Si implementamos salida inmediata al panel, este modal puede:
  - mostrarse brevemente sobre el live antes de navegar, o
  - desaparecer del flujo del doctor y usar mensajes/toasts + estado “Procesando…” en Grabaciones
- La data detallada del live NO debe seguir apareciendo aquí.

5. Mover la data al panel correcto
- En `src/pages/DoctorRecordings.tsx` agregar tabs:
  - `Grabaciones`
  - `Lives pasados`
- `Grabaciones`:
  - solo lives guardados como grabación
  - mantener compras e ingresos por grabaciones
  - si una grabación está procesándose, mostrar card/fila con badge “Procesando…”
- `Lives pasados`:
  - listar lives terminados sin grabación asociada
  - mostrar métricas:
    - pico de espectadores
    - likes
    - comentarios
    - comentarios de pago
    - ingresos por chats de pago
    - fecha
- Al llegar desde el cierre del live:
  - si se guardó: abrir tab `grabaciones`
  - si no se guardó: abrir tab `lives-pasados`

6. Fuente de datos para “Lives pasados”
- No hace falta cambiar base de datos.
- Ya existen campos suficientes en `lives` y `live_chat_messages`:
  - `peak_viewers`
  - `likes_count`
  - `questions_count` / conteo de comentarios
  - `paid_chats_count`
  - `chat_price`
  - `live_id`
  - relación opcional con `recordings.live_id`
- Implementar consulta para traer lives terminados del doctor y separarlos por:
  - con grabación
  - sin grabación

7. UX/UI optimizada para doctores mayores
- Textos más directos, menos pasos, menos modales.
- Botones grandes, alto mínimo 48px.
- Jerarquía clara:
  - primero decisión
  - luego salida automática
  - luego seguimiento desde Grabaciones
- Copys sugeridos:
  - “Guardar este live como contenido premium”
  - “Si lo guardas, aparecerá en Grabaciones mientras termina de procesarse”
  - “Si no lo guardas, sus métricas quedarán en Lives pasados”

Archivos a modificar
- `src/pages/DoctorGoLive.tsx`
- `src/components/live/LiveDialogs.tsx`
- `src/components/live/EndingLiveModal.tsx`
- `src/pages/DoctorRecordings.tsx`

Resultado esperado
- Nunca vuelven a salir 2 ventanas.
- “Continuar transmitiendo” siempre funciona mientras el doctor no confirme salida.
- La decisión de guardar/no guardar ocurre en la misma ventana de finalizar.
- El doctor sale rápido del live sin esperar todo el procesamiento.
- Si guarda, va a `Grabaciones` y ve que se está procesando.
- Si no guarda, ve sus métricas en `Lives pasados`.

Detalles técnicos
- El problema actual nace del flujo secuencial entre `showEndDialog`, `showEndingModal`, `AlertDialogAction` y `isEnding`.
- La corrección correcta no es seguir ajustando delays, sino eliminar la segunda decisión modal y convertir el cierre en una sola interacción controlada.
- No veo necesidad de cambios de esquema; es principalmente refactor de UI/estado y reorganización del panel de grabaciones.
