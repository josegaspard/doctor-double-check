
Objetivo: añadir gestión masiva en “Lives pasados” y corregir el sidebar de “Especialidades/Ciudades” para que realmente quede sticky durante el scroll.

Qué vi en el código
- `src/pages/DoctorRecordings.tsx` ya tiene modo selección, selección múltiple y borrado masivo, pero solo para la pestaña `Grabaciones`.
- La pestaña `Lives pasados` hoy solo lista filas/cards; no tiene acciones por fila, ni selección, ni exportación.
- `pastLives` sale directo de la tabla `lives` filtrando lives terminados sin grabación asociada.
- `src/pages/Doctors.tsx` ya tiene `aside` con `sticky top-24`, pero está dentro de un layout con wrappers animados/containers; por cómo está armada la estructura, el sticky no está comportándose como el usuario espera.

Plan de implementación

1. Extender “Lives pasados” con el mismo patrón de selección masiva
- Separar el estado de selección de grabaciones y el de lives pasados para no mezclar IDs entre tabs.
- Añadir en “Lives pasados”:
  - botón `Seleccionar`
  - `Todas / Deseleccionar`
  - selección por fila/card
  - barra flotante inferior con acciones masivas
- Mantener el mismo lenguaje visual y comportamiento que ya existe en `Grabaciones`.

2. Permitir eliminar uno, varios o todos en “Lives pasados”
- Añadir acción individual “Eliminar” por fila/card en lives pasados.
- Añadir confirmación para:
  - eliminar un live pasado
  - eliminar varios seleccionados
- La eliminación debe borrar el registro del live terminado del backend y actualizar la lista local.
- Si hay restricciones por relaciones en backend, el fallback del plan será “ocultar/archivar” visualmente, pero primero se intentará con borrado directo porque la UI actual está basada en `lives`.

3. Añadir descarga de uno, varios o todos en “Lives pasados”
- Implementar exportación CSV reutilizando el patrón ya usado en otras pantallas del proyecto.
- Opciones:
  - descargar una fila individual
  - descargar seleccionados
  - descargar todos los lives filtrados/visibles
- Incluir columnas útiles:
  - título
  - especialidad
  - fecha inicio
  - fecha fin
  - pico espectadores
  - likes
  - comentarios totales
  - comentarios de pago
  - precio chat
  - ingresos chats
- Esto resuelve rápido la necesidad de “descargar 1 o varios o todos” sin depender de archivos de video, porque “Lives pasados” son métricas, no grabaciones.

4. Mejorar el header/toolbar de “Lives pasados”
- Añadir una toolbar clara en el `CardHeader` similar a Grabaciones:
  - contador de filas
  - `Seleccionar`
  - `Descargar todo`
- En modo selección, la barra flotante mostrará al menos:
  - `Descargar`
  - `Eliminar`

5. Corregir el sticky real del sidebar izquierdo en `/doctors`
- Reestructurar el layout del bloque principal para que el sidebar viva en una columna estable de grid/flex sin interferencia del contenedor del listado.
- Mantener el `aside` como `self-start sticky top-24` pero ajustando el contenedor padre para evitar que el sticky quede “encerrado”.
- Conservar su scroll interno (`max-h + overflow-y-auto`) para que especialidades/ciudades sigan accesibles aunque la página sea larga.
- Verificar también el breakpoint: solo desktop/tablet (`md:block`) y que en mobile sigan los chips horizontales.

Archivos a modificar
- `src/pages/DoctorRecordings.tsx`
  - selección masiva para `Lives pasados`
  - eliminar individual/masivo
  - exportación CSV individual/masiva/todo
  - nuevos diálogos de confirmación si hace falta
- `src/pages/Doctors.tsx`
  - ajuste estructural del layout para sticky real del sidebar izquierdo

Detalles técnicos
- No parece requerir cambio de esquema; es una mejora de UI + lógica cliente.
- Para exportación, conviene reutilizar el patrón de `Blob + URL.createObjectURL + download`.
- Para no romper `Grabaciones`, conviene crear estado separado, por ejemplo:
  - `recordingSelectionMode`, `selectedRecordingIds`
  - `pastLivesSelectionMode`, `selectedPastLiveIds`
- Para sticky, la solución correcta no es solo “más clases sticky”, sino corregir el contexto del layout donde vive el `aside`.

Resultado esperado
- En “Lives pasados” se podrá eliminar 1, varios o todos.
- En “Lives pasados” se podrá descargar 1, varios o todos.
- El flujo será consistente con “Grabaciones”.
- El sidebar izquierdo de `/doctors` quedará fijo mientras el usuario baja por la lista, en vez de “quedarse ahí” mal posicionado.
