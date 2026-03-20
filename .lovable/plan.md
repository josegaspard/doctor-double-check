

# Plan: Mejorar UX/UI del dialog "Editar portada" con drag & drop + i18n

## Cambios

### 1. `src/pages/DoctorRecordings.tsx` — Rediseñar el dialog de thumbnail (líneas 1856-1898)
- Reemplazar el `<Input type="file">` por una zona de drag & drop con:
  - Borde punteado, icono de upload, texto "Arrastra una imagen aquí o haz clic para seleccionar"
  - Soporte `onDragOver/onDrop` + click para abrir file picker
  - Preview de la imagen seleccionada con botón para cambiar/quitar
- Botón "Guardar portada" más visible (full-width en mobile)
- Usar traducciones `t()` en todos los textos del dialog
- Los textos de los menús "Editar portada" también deben usar `t()`

### 2. `src/lib/i18n/es.ts` — Agregar keys de traducción
- Dentro de `recordings` o nuevo bloque `thumbnail`:
  - `editCover`: "Editar portada"
  - `editCoverDesc`: "Sube una imagen de portada para"
  - `noCover`: "Sin portada"
  - `selectImage`: "Seleccionar imagen"
  - `dragOrClick`: "Arrastra una imagen aquí o haz clic para seleccionar"
  - `saveCover`: "Guardar portada"
  - `savingCover`: "Guardando..."
  - `coverUpdated`: "Portada actualizada"
  - `coverError`: "Error al actualizar portada"
  - `cancel`: ya existe

### 3. `src/lib/i18n/en.ts` — Traducciones en inglés
- Mismas keys:
  - `editCover`: "Edit cover"
  - `editCoverDesc`: "Upload a cover image for"
  - `dragOrClick`: "Drag an image here or click to select"
  - `saveCover`: "Save cover"
  - `savingCover`: "Saving..."
  - etc.

## Archivos a modificar
1. `src/pages/DoctorRecordings.tsx` — dialog con drag & drop + i18n
2. `src/lib/i18n/es.ts` — nuevas keys
3. `src/lib/i18n/en.ts` — nuevas keys

