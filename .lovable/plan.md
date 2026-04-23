

## MEGAPROMPT: Fondo perfecto + contraste global tipo "modo noche"

### Diagnóstico de los 3 problemas reales

1. **Línea blanca entre header y fondo** → el header tiene `border-b border-white/10` y además su color `#0b1d45/95` no coincide al 100% con el primer pixel de la imagen (que es ligeramente más oscuro/azulado). El navegador renderiza ambos y deja una línea visible.
2. **Imagen tarda en cargar** → `app-background.jpg` pesa 93 KB y se carga vía `import` normal (no preload), con `background-attachment: fixed` + `background-size: cover`. El primer paint muestra el `bg-background` blanco antes de que la imagen esté lista.
3. **Contraste incompleto** → varias páginas tienen iconos, badges, valores numéricos, separadores, inputs, dropdowns y placeholders que no están cubiertos por las reglas actuales del `.app-bg-image`.

### Solución completa (sin tocar En Vivo)

#### 1) Eliminar la línea de separación (definitivo)

- En `MainLayout.tsx`, header: cambiar `border-b border-white/10` por `border-b-0` cuando `useImageBackground` está activo. El cambio de tono lo hace solo la transición visual, sin línea.
- En `AppBackground.tsx`: pintar un **fallback color sólido** (`background-color: #0b1d45`) DEBAJO de la imagen, así mientras carga ya se ve el mismo azul del header → cero salto visual y cero línea.
- En `index.css` `.app-bg-image`: añadir `background-color: #0b1d45` al root para reforzar el fallback.

#### 2) Carga ultrarrápida del fondo

- **Preload del JPG** en `index.html` con `<link rel="preload" as="image" href="/app-bg.jpg" fetchpriority="high">` para que el navegador empiece a descargarlo en paralelo al HTML.
- **Mover el archivo a `/public/app-bg.jpg`** (no a `src/assets/`) para que sea servible por URL fija sin hash y permitir el `<link rel="preload">` (los assets de `src/` cambian de hash en cada build y rompen el preload).
- Actualizar `AppBackground.tsx`: usar `url('/app-bg.jpg')` en vez del import. Mantener un comentario claro de que la imagen vive en `public/app-bg.jpg`.
- Añadir `background-color: #0b1d45` como fallback inmediato (ya descrito arriba).
- Mantener `background-attachment: fixed` en desktop pero **`scroll` en móvil** (en iOS `fixed` dispara repintes y se ve mal). Se hace con media query.

#### 3) Contraste GLOBAL completo (modo noche)

Reescribir/extender el bloque `.app-bg-image` en `index.css` para cubrir todo lo que falta:

- **Iconos sueltos** (`svg` directo dentro de main) → blanco con opacidad 0.85.
- **Inputs / textareas / select sueltos** → fondo `rgba(255,255,255,0.08)`, borde `rgba(255,255,255,0.2)`, texto blanco, placeholder `rgba(255,255,255,0.5)`.
- **Badges sueltos** (`secondary`, `outline`) → variantes con fondo translúcido blanco y texto blanco.
- **Tabs / TabsList sueltos** → fondo translúcido blanco, indicador activo blanco sólido.
- **Dropdowns trigger sueltos** → fondo translúcido, hover blanco semi.
- **Loaders / spinners** → color blanco.
- **Borders sueltos** (`border`, `border-t`, `border-input`) → blanco translúcido.
- **`text-primary` suelto** (no en card) → `hsl(195, 90%, 75%)` (cyan claro legible sobre azul).
- **`text-success` / `text-warning` / `text-destructive` sueltos** → mantener color pero saturarlos un 20% para que destaquen sobre azul.
- **Hover de links del header** → ya está pero refuerzo con `text-shadow` sutil.
- **Footer**: ya es `#0b1d45` sólido, no necesita cambios. Solo aseguro que el `border-t` superior del footer sea `transparent` para evitar otra línea de separación entre `<main>` y `<footer>`.

#### 4) Reglas que protegen las superficies blancas (cards/dialogs/popovers)

- Mantener intacto: `bg-card`, `bg-popover`, `bg-background`, `bg-muted`, `[role="dialog"]` no se tocan → siguen siendo blancos con texto oscuro como hoy.
- Subir las que están en `bg-card/95` o `bg-card/80` que sobre azul se transparentan demasiado → pasarlas a `bg-card` sólido (revisión puntual de Header móvil sheet, MoreSheet y banners).

#### 5) Separación limpia footer ↔ contenido

- Quitar `border-t` del primer hijo de `<footer>` cuando `useImageBackground` está activo (regla CSS específica) para que el `#0b1d45` del footer se funda con el degradado azul oscuro de la imagen sin línea visible.

#### 6) Cómo cambiar la imagen en el futuro (documentado)

- **Sustituir `public/app-bg.jpg`** por otra imagen del mismo nombre (1920×1080 o superior, < 200 KB ideal, JPG progresivo).
- O cambiar la ruta en `src/components/layout/AppBackground.tsx` (constante `BG_URL`).
- Para volver a blanco: **Admin → Site Settings → Toggles → Fondo de la aplicación → Blanco (clásico)**.

### Lo que NO toco
- En Vivo (`LiveStreamView`, `DailyVideoPlayer`, `LivePreviewPlayer`, `LivesGrid`, `LivePlayer`, `VideoCall`).
- Landing pública (`/`).
- Tokens del design system (`--primary`, `--card`, etc.).
- Lógica de auth, pagos, video, RLS, edge functions.

### Archivos modificados
- `index.html` (preload del JPG)
- `public/app-bg.jpg` (nuevo, mover desde `src/assets/`)
- `src/components/layout/AppBackground.tsx` (URL pública + fallback color + media query móvil)
- `src/components/layout/MainLayout.tsx` (quitar `border-b` del header en modo imagen)
- `src/components/layout/UnifiedFooter.tsx` (quitar línea superior cuando aplica modo imagen)
- `src/index.css` (bloque `.app-bg-image` ampliado: iconos, inputs, badges, tabs, loaders, borders, colores semánticos)

### Resultado final
- **Cero línea de separación** entre header, contenido y footer.
- **Fondo visible al instante** (color sólido `#0b1d45` antes incluso de descargar la imagen, luego la imagen aparece encima).
- **Contraste tipo modo noche** garantizado en todos los elementos sueltos: títulos, párrafos, links, botones, **iconos, inputs, badges, tabs, dropdowns, loaders, separadores**.
- **Cards y modales intactos** (siguen blancos con texto oscuro).
- Funciona idéntico en **móvil y desktop** (con `attachment: scroll` en móvil para evitar el bug de iOS).
- Toggle de admin sigue funcional para volver a blanco clásico.

