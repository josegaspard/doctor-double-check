

# Plan: Contenido Premium con layout tipo Directorio de Doctores + Checklist de pendientes

## Cambio principal: Layout de ContentGallery como Doctors

Rediseñar `src/pages/ContentGallery.tsx` para que use el mismo patrón de layout que `src/pages/Doctors.tsx`:

### Layout
- **Desktop**: Grid `md:grid-cols-[14rem_1fr]` con sidebar sticky a la izquierda
- **Mobile**: Chips horizontales scrollables (ocultar sidebar)

### Sidebar izquierdo (desktop)
1. **Especialidades** — lista vertical con las mismas especialidades del directorio de doctores (Cardiología, Cirugía General, Dermatología, etc.), filtrar contenido por `creator_specialty`
2. **Separador**
3. **Tipo de contenido** — Videos, PDFs, Presentaciones, Imágenes (en lugar de ciudades)
4. **Separador**
5. **Categorías** — las categorías dinámicas que ya existen

### Mobile
- Fila de chips horizontales para especialidades
- Fila de chips horizontales para tipo de contenido
- Mantener tabs de All/Purchased/New

### Filtro por especialidad
- Al cargar contenido, ya se tiene `creator_specialty` del join con `doctor_profiles_public`
- Filtrar client-side por especialidad seleccionada
- Agregar "Presentaciones" como tipo de contenido (el tipo `pdf` con categoría "Presentación" o nuevo tipo)

### Archivos a modificar
1. **`src/pages/ContentGallery.tsx`** — Reestructurar layout completo: agregar sidebar, grid layout, filtro por especialidad, chips mobile

---

## Checklist de pendientes del cliente

| Requisito | Estado |
|-----------|--------|
| Quitar noticias (toggle) | Done (Fase 2) |
| Live chat gratis (toggle) | Done (Fase 2) |
| Lives filtro por especialidad | Done (ya existe en LivesGrid) |
| Grabaciones → Contenido Premium | Done (Fase 2) |
| Contenido Premium incluya presentaciones | **Pendiente** — agregar en este cambio |
| Doctores sin opción de consulta (para doctors/residents) | **Pendiente — Fase 6** |
| Quitar contenido médico (toggle) | Done (Fase 2) |
| Chat dos ventanas (pacientes/doctores) | **Pendiente — Fase 4** |
| Recetas → Reuniones | Done (Fase 2) |
| Reuniones con Daily.co | Done (Fase 5) |
| Disponibilidad tipo Calendar | Done (Fase 1) |
| Expediente Médico | Done (Fase 3) |
| Calculadoras de salud | Done (mejoradas) |
| Quitar historial transacciones (toggle) | Done (Fase 2) |
| Residentes: red de doctores, inscribir→aceptar→reuniones | **Pendiente — Fase 6** |
| Residentes: cuánto gastaron/vendieron | **Pendiente — Fase 6** |
| Resumen post-consulta del doctor | **Pendiente — Fase 4/6** |
| ContentGallery layout como Doctors | **Este cambio** |

---

## Detalle técnico

En `ContentGallery.tsx`:
- Importar `useIsMobile` para responsive
- Agregar estado `selectedSpecialty` con la misma lista de especialidades
- Agregar filtro en `filteredContents` que compare `content.creator_specialty === selectedSpecialty`
- Wrappear el contenido en `md:grid md:grid-cols-[14rem_1fr] md:gap-6 md:items-start`
- Sidebar: `aside` sticky con lista de especialidades + tipos + categorías
- Mobile: chips horizontales scrollables para especialidades (ocultar sidebar con `hidden md:block`)
- El grid de tarjetas queda en la columna derecha

