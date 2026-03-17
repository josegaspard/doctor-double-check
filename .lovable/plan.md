

## Plan: Badges "Disponible en App Store / Google Play" en el Footer

### Qué se hará
Agregar badges oficiales de App Store y Google Play en ambas variantes del footer (landing y app), completamente responsive.

### Cambios

**1. Crear componente `AppStoreBadges` dentro de `UnifiedFooter.tsx`**
- Dos badges SVG inline (Apple App Store + Google Play) con enlaces `#` (placeholder hasta tener URLs reales).
- En mobile: badges apilados o lado a lado centrados.
- En desktop: badges en línea horizontal.
- Estilo: badges con fondo semitransparente blanco, bordes redondeados, hover sutil.

**2. Insertar en ambas variantes del footer**
- **Landing variant**: Debajo de los social icons en la columna de marca (línea ~123), antes del grid de links.
- **App variant**: Debajo de los social icons en la columna de marca (línea ~90).
- También se mostrará en la barra inferior (junto al copyright y status badge) en ambas variantes para máxima visibilidad.

**3. Archivos a editar**
- `src/components/layout/UnifiedFooter.tsx` — único archivo.

### Diseño responsive
- Mobile (`< sm`): Badges lado a lado, tamaño compacto (h-9).
- Tablet/Desktop (`sm+`): Badges en línea, tamaño estándar (h-10).
- Los badges usarán SVG inline para evitar dependencias externas y carga rápida.

