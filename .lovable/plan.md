

# Quitar sección de Portada del Live

Eliminar el bloque completo de thumbnail (líneas 182-219) en `src/components/live/LiveSetupForm.tsx`, incluyendo el label, input file, preview de imagen, botón de subir, y el texto de recomendación.

También limpiar las variables y funciones relacionadas al thumbnail que ya no se usarán (`thumbnailFile`, `thumbnailPreview`, `handleThumbnailChange`, `removeThumbnail`, `fileInputRef`, `ImagePlus` import si no se usa en otro lugar).

**Archivo a modificar:** `src/components/live/LiveSetupForm.tsx`

