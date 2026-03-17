
Objetivo: rehacer solo las 2 partes rotas sin tocar lo demás.

1. Pantalla completa: rehacerla bien
- El problema actual es que `DailyVideoPlayer` usa fullscreen por CSS dentro de layouts con grid/contenedores, y además `LiveStreamView` le inyecta clases propias. Eso hace que “crezca hacia la derecha” en vez de ocupar toda la pantalla.
- Voy a cambiar la lógica para que el player use la Fullscreen API real del navegador como fuente principal:
  - `requestFullscreen()` / `exitFullscreen()`
  - listener `fullscreenchange` para sincronizar estado
  - fallback CSS solo si el navegador no soporta fullscreen real
- También voy a quitar la duplicación de fullscreen entre `DailyVideoPlayer` y `LiveStreamView`, para que exista una sola lógica.
- Comportamiento esperado:
  - móvil: fullscreen real ocupando toda la pantalla, priorizando horizontal cuando el sistema lo permita
  - tablet: ocupar toda la pantalla sin salirse a la derecha
  - PC: llenar viewport completo sin quedar atrapado por el grid o el contenedor

2. PDF: dejar de romper la visualización
- El problema actual es el visor PDF nativo embebido; ahora está fallando y por eso sale el documento roto.
- No voy a seguir tocando el PDF con soluciones que bloqueen la lectura.
- Voy a reemplazar únicamente la vista previa PDF de Biblioteca de Contenido por un renderizado propio:
  - cargar el PDF en memoria
  - renderizar páginas dentro del modal
  - desactivar clic derecho y atajos como guardar/imprimir solo en esa vista
  - no mostrar toolbar nativo del navegador
  - no exponer el enlace firmado directamente en el DOM visible
- Esto mantiene el PDF visible y además endurece mejor la protección que el `iframe`.

3. Archivos a tocar
- `src/components/live/DailyVideoPlayer.tsx`
- `src/components/live/LiveStreamView.tsx`
- `src/pages/LivePlayer.tsx` si hace falta ajustar el contenedor del viewer
- `src/components/content/ContentPreviewModal.tsx`
- `package.json` si agrego el renderizador PDF necesario

4. Resultado final que voy a buscar
- fullscreen correcto en móvil, tablet y desktop
- nada de video corrido a la derecha
- PDF visible otra vez
- clic derecho bloqueado solo en la vista previa PDF
- menos exposición del enlace real del archivo, aunque la protección total contra inspección del navegador no existe al 100%; sí se puede endurecer bastante mejor que ahora
