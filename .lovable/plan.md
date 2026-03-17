

# Bloquear clic derecho en PDFs de Biblioteca de Contenido

## Problema
El iframe del PDF permite clic derecho → "Save As..." / "Print...", lo que expone los archivos que deben ser confidenciales. El `onContextMenu` en el `DialogContent` padre no intercepta clics dentro del iframe porque tiene su propio contexto de documento.

## Solución

**Archivo:** `src/components/content/ContentPreviewModal.tsx` (líneas 124-143)

Agregar una capa transparente (`div`) posicionada absolutamente encima del iframe con `z-10` que:
- Intercepte todos los clics derechos con `onContextMenu={(e) => e.preventDefault()}`
- Sea completamente transparente visualmente
- Bloquee la interacción directa con el iframe (no se puede hacer clic derecho en el PDF)

El iframe seguirá visible y el PDF se podrá leer/scrollear a través del overlay (el scroll pasa a través de capas transparentes en la mayoría de navegadores). También se agrega `sandbox="allow-same-origin allow-scripts"` al iframe para restringir capacidades adicionales y `userSelect: 'none'` al contenedor.

Nota: El overlay bloquea la interacción directa con el iframe, incluyendo el scroll en algunos navegadores. Como alternativa, se puede usar `pointer-events: none` en el overlay excepto para el evento contextmenu, pero esto requiere JavaScript adicional. La solución más robusta es usar el overlay con `pointer-events: none` y un listener global de `contextmenu` en el contenedor padre — el iframe ya tiene `#toolbar=0&navpanes=0` que oculta los controles de descarga del visor PDF integrado.

**Cambio concreto en `ContentPreviewModal.tsx`:**
- Envolver el iframe en un `<div>` con `onContextMenu` bloqueado
- Agregar `style={{ userSelect: 'none' }}` al contenedor
- Usar un overlay transparente con `pointer-events: none` pero interceptando contextmenu via JavaScript en el contenedor padre

