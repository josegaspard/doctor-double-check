

# Plan: Footer Unificado + Categorias UX + Sincronizacion de Contenidos

## 1. Footer Unificado Completo (Landing + App)

**Problema**: El footer del app solo muestra links legales + redes sociales, pero el usuario quiere que TAMBIEN incluya los items de Plataforma y Recursos (como el footer de la landing), todo administrable.

**Cambios en `UnifiedFooter.tsx`**:
- Variante `app`: Agregar las 3 columnas (Plataforma, Recursos, Legal) en un grid compacto debajo del logo + redes sociales, en lugar de solo mostrar links legales en una linea
- En desktop: Grid de 4 columnas (Logo+Redes | Plataforma | Recursos | Legal)
- En tablet: Grid de 2x2
- Mantener logo, redes sociales, copyright y badge de status
- Todo se sigue leyendo desde `site_settings` (footer_links + social_links), por lo que ya es administrable

No se necesitan cambios en el admin ni en la base de datos -- la configuracion ya existe y es editable.

---

## 2. Categorias UX/UI - Scroll Horizontal Optimizado

**Problema**: Las categorias se cortan visualmente en PC/tablet. En movil se puede arrastrar pero en PC no es claro.

**Cambios en `MedicalNews.tsx`**:
- Agregar flechas de navegacion (chevron izquierda/derecha) en PC y tablet para indicar que hay mas categorias
- Las flechas aparecen solo cuando hay overflow (contenido oculto a izquierda o derecha)
- En movil: mantener el scroll tactil con `overflow-x-auto`
- Aplicar el mismo patron a los filtros de sort (Recientes, Mas leidos, Mas comentados)
- Agregar `scroll-smooth` para animacion suave al hacer clic en las flechas

---

## 3. Sincronizacion de Contenido Eliminado

**Problema**: El usuario dice que borro contenidos pero siguen apareciendo en "Biblioteca de Contenido" (ContentGallery). Los registros aun existen en la base de datos (`doctor_content` tiene 33+ filas). Esto indica que la eliminacion no se completo correctamente o se hizo solo desde el almacenamiento pero no de la BD.

### 3a. Agregar eliminacion en DoctorUpload ("Subir Contenido")

**Cambios en `DoctorUpload.tsx`**:
- En la seccion "Mi Contenido", agregar un boton de eliminar individual (icono Trash) en cada item
- Agregar modo de gestion masiva: boton "Gestionar" que activa checkboxes, seleccionar todo, y eliminar seleccionados
- Barra flotante de eliminacion masiva (mismo patron glassmorphism del plan anterior)
- Dialogo de confirmacion antes de eliminar
- Al eliminar: borrar registro de `doctor_content` + archivos del bucket `doctor-content` y `thumbnails`
- Refrescar la lista local tras eliminar

### 3b. ContentGallery ya sincroniza automaticamente

**`ContentGallery.tsx`** ya consulta `doctor_content` con `is_public = true` en cada carga. Si los registros se eliminan correctamente de la BD, dejaran de aparecer automaticamente. No necesita cambios de codigo.

El problema real es que los contenidos NO fueron eliminados de la base de datos. La solucion es darle al doctor herramientas para eliminarlos desde la UI (DoctorUpload y DoctorContentLibrary ya tienen delete).

### 3c. DoctorContentLibrary ya tiene eliminacion

**`DoctorContentLibrary.tsx`** ya tiene eliminacion individual y masiva. No necesita cambios.

---

## Resumen de archivos

**Archivos a modificar (3)**:
- `src/components/layout/UnifiedFooter.tsx` -- Footer app con todas las columnas (Plataforma, Recursos, Legal), no solo links legales
- `src/pages/MedicalNews.tsx` -- Flechas de navegacion para categorias en PC/tablet
- `src/pages/DoctorUpload.tsx` -- Agregar eliminacion individual y masiva en "Mi Contenido"

**Sin archivos nuevos ni migraciones SQL** -- se reutiliza la infraestructura existente.

---

## Detalles tecnicos

### Footer App - Layout unificado
```text
Desktop (md+):
[Logo + Redes] | [Plataforma] | [Recursos] | [Legal]
---separator---
[Copyright]                              [Status Badge]

Tablet (sm):
[Logo + Redes]
[Plataforma | Recursos]
[Legal]
---separator---
[Copyright] [Status Badge]
```

### Categorias con flechas
```text
[<] [Todas] [Cardiologia] [Neurologia] ... [Cirugia] [>]
     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
     overflow-x-auto, scroll-smooth, scrollbar-hide
```
Las flechas se ocultan automaticamente cuando no hay mas contenido en esa direccion usando `useRef` + `scrollLeft` detection.

### Eliminacion en DoctorUpload
- Reutilizar la misma logica de `deleteContent()` de `DoctorContentLibrary.tsx` (extraer path del storage, borrar de BD, luego borrar archivos)
- Agregar `AlertDialog` de confirmacion
- Modo gestion: checkboxes + seleccionar todo + barra flotante

