

# Plan: Fullscreen del viewer + PDF visible sin clic derecho

## Problema 1: Fullscreen del viewer se rompe

El `DailyVideoPlayer` usa `externalClassName` cuando se le pasa, y si no, usa su default con la lógica de fullscreen (`fixed inset-0 z-[60]...`). El viewer en `LivePlayer.tsx` (línea 430) NO pasa className, así que usa el default — esto debería funcionar.

Sin embargo, el problema es que cuando el viewer está dentro del grid layout (`lg:grid-cols-3`, línea 415), el `fixed inset-0` del fullscreen compite con el contenedor del grid. El `DailyVideoPlayer` wrapper se convierte en `fixed` pero sigue siendo hijo del DOM del grid, y en algunos navegadores el `overflow-hidden` del contenedor padre puede cortar el elemento fijo.

**Solución:**
- En `DailyVideoPlayer.tsx` línea 398-401: cuando `isFullscreen`, forzar el estilo a `fixed inset-0 z-[9999] w-screen h-[100dvh]` con z-index muy alto y asegurar que no herede `rounded` ni `overflow-hidden` del padre.
- El z-index actual `z-[60]` puede estar por debajo de otros overlays (modals, headers). Subir a `z-[9999]`.

## Problema 2: PDF no se puede ver (overlay bloquea scroll)

El overlay transparente (`absolute inset-0 z-10`) bloquea **toda** interacción con el iframe, incluyendo scroll. Por eso el PDF "no se puede ver" — está ahí pero no se puede hacer scroll.

**Solución en `ContentPreviewModal.tsx`:**
- Cambiar el overlay a `pointer-events-none` para que el scroll pase al iframe.
- Usar un event listener de `contextmenu` en el contenedor padre (`onContextMenu` en el wrapper div) que ya existe.
- Quitar el overlay div completamente — el `onContextMenu` del wrapper padre + `sandbox` del iframe + `#toolbar=0&navpanes=0` ya son suficientes para bloquear clic derecho y ocultar controles.
- Añadir CSS para desactivar selección de texto (`user-select: none`).
- La URL firmada ya es temporal (1 hora) y el blob URL es un `blob:` que no se puede compartir entre sesiones. No se necesita "encriptación" adicional — el blob URL ya oculta la URL real del archivo.

## Archivos a modificar

1. **`src/components/live/DailyVideoPlayer.tsx`** (línea 398-401):
   - Cambiar `z-[60]` a `z-[9999]` en el modo fullscreen
   - Asegurar que no herede overflow del padre

2. **`src/components/content/ContentPreviewModal.tsx`** (líneas 131-145):
   - Quitar el overlay div que bloquea el scroll del PDF
   - Mantener `onContextMenu` en el contenedor padre
   - El iframe con `sandbox` + `#toolbar=0` sigue protegiendo contra descarga

