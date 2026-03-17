

# Plan: Mejorar UX/UI del sidebar de filtros en Doctores (desktop/tablet)

## Problema actual
El sidebar ya tiene `sticky` y `overflow-y-auto`, pero visualmente se ve plano y sin separación clara del contenido. Falta:
- Fondo sutil y borde para separar visualmente del contenido
- Scrollbar estilizada (actualmente usa la nativa del browser)
- Padding y bordes redondeados para verse como un panel real
- Soporte para tablet (actualmente solo `lg:block`, tablets medianas no lo ven)

## Cambios en `src/pages/Doctors.tsx`

### Sidebar (`aside`, línea 328)
1. Cambiar breakpoint de `lg:block` a `md:block` para que tablets también lo vean
2. Agregar fondo `bg-card`, borde `border rounded-xl`, y padding `p-4`
3. Usar `scrollbar-hide` o estilizar con CSS slim scrollbar para que el scroll sea discreto
4. Ajustar `top` y `max-h` para alinearse mejor con el layout
5. Agregar separador visual (`border-t` o `Separator`) entre la sección de Especialidades y Ciudades

### Chips móviles
- Ajustar breakpoint correspondiente de `lg:hidden` a `md:hidden` para coincidir

### Resultado visual
Panel lateral con fondo card, bordes redondeados, scroll interno discreto, visible desde tablets (768px+), separación clara entre secciones.

## Archivos a modificar
1. `src/pages/Doctors.tsx` — clases del sidebar y breakpoints

