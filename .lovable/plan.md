

# Plan: Eliminar burbuja flotante + Mejorar UX/UI del formulario de Iniciar Transmisión

## Parte 1: Eliminar LiveStreamBubble y ActiveStreamContext

Eliminar completamente el componente de burbuja flotante y el contexto de stream activo, ya que el usuario no los quiere. Limpiar todas las referencias.

### Archivos a eliminar
- `src/components/live/LiveStreamBubble.tsx`
- `src/contexts/ActiveStreamContext.tsx`

### Archivos a modificar

**`src/App.tsx`**
- Quitar imports de `ActiveStreamProvider` y `LiveStreamBubble`
- Quitar `<ActiveStreamProvider>` wrapper y `<LiveStreamBubble />` del JSX

**`src/pages/DoctorGoLive.tsx`**
- Quitar import y uso de `useActiveStream`
- Restaurar lógica local autónoma: timer local, sin `minimizeStream`/`maximizeStream`, sin `startStream`/`endStream` del contexto
- Restaurar el guard de navegación con `beforeunload` (ya existe) sin la lógica de minimizar
- El Daily call se crea y destruye localmente como antes

## Parte 2: Mejorar UX/UI del LiveSetupForm

Rediseñar completamente `src/components/live/LiveSetupForm.tsx` para que sea más intuitivo, especialmente en móvil, y que el campo de precio no pase desapercibido.

### Cambios de diseño

1. **Estructura por pasos visuales** — Agrupar en secciones claras con números/iconos:
   - Sección 1: "¿De qué trata tu live?" (Título + Descripción + Especialidad)
   - Sección 2: "Grabación y monetización" (Switch de grabar + **Precio destacado con fondo de color, icono de dinero, y texto guía claro**)
   - Sección 3: "Configuración del chat" (Switch + límites opcionales, colapsado por defecto)
   - Sección 4: "Etiquetas" (opcional, colapsado o compacto)

2. **Precio de grabación prominente** — Campo con fondo `bg-primary/5` o `bg-amber-50`, icono de `$`, helper text más claro: "¿Cuánto cobrarás por la grabación? Escribe 0 si será gratuita". Input más grande con prefix "$" visual.

3. **Campos obligatorios claros** — Asteriscos rojos visibles, validación visual inline.

4. **Mobile-first** — Padding reducido, secciones con separadores claros, el sticky button ya existe y se mantiene. Quitar la Card wrapper innecesaria para ganar espacio en móvil — usar secciones directas.

5. **Quitar elementos no usados** — Eliminar `showRtmpsInfo` y el bloque OBS que nunca se muestra (no hay botón que lo active). Quitar `thumbnailFile` del interface `LiveConfig`.

6. **Simplificar chat settings** — Los límites de "máximo de preguntas" y "máximo de orientaciones pagadas" son opcionales y confusos. Colocarlos dentro de un Collapsible "Opciones avanzadas" para no abrumar.

### Archivo a modificar
- `src/components/live/LiveSetupForm.tsx`

