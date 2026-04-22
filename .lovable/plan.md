

## Aplicar el fondo azul en TODAS las pantallas + contraste real garantizado

### Problema
1. Login, Onboarding, ResetPassword, EmailConfirmed, RoleSelector, VerificationPending, NotFound, AccessDenied **NO usan `MainLayout`**, así que siguen con `bg-background` blanco. El fondo nuevo solo aplica en pantallas autenticadas.
2. Las reglas de contraste actuales en `index.css` son muy específicas (`.app-bg-image > main > div > h1`), por eso muchos títulos siguen oscuros sobre el azul.
3. Botones `ghost` y `outline` y links normales no tienen reglas de contraste sobre fondo azul.

### Solución (sin tocar En Vivo)

**1. Crear un wrapper único `AppBackground`**
- Nuevo: `src/components/layout/AppBackground.tsx`
- Encapsula la lógica del toggle `app_background`, la imagen, el overlay y aplica la clase `.app-bg-image` al root.
- `MainLayout` y todas las páginas standalone (Login, Onboarding, etc.) lo usan.

**2. Envolver TODAS las pantallas standalone con el fondo**
Reemplazar `<div className="min-h-screen bg-background ...">` por `<AppBackground className="min-h-screen ...">` en:
- `src/pages/Login.tsx` (quita `DecorativeBackground` y `bg-background`)
- `src/pages/Onboarding.tsx` (3 returns)
- `src/pages/ResetPassword.tsx` (2 returns)
- `src/pages/EmailConfirmed.tsx`
- `src/pages/RoleSelector.tsx` (quita `DecorativeBackground`)
- `src/pages/VerificationPending.tsx` (2 returns)
- `src/pages/AccessDenied.tsx`
- `src/pages/NotFound.tsx` (cambia `bg-muted` por `AppBackground`)

**Resultado:** cero pantallas en blanco. La imagen azul es global en TODA la app (excepto Landing pública y En Vivo, que tienen su propio fondo intencional).

**3. Endurecer las reglas de contraste en `src/index.css`**
Reescribir el bloque `.app-bg-image` para garantizar contraste sin importar la profundidad del DOM:

```css
/* Todos los títulos sueltos (no dentro de card/popover/dialog) en blanco */
.app-bg-image h1:not([class*="bg-card"] *):not([class*="bg-popover"] *):not([class*="bg-background"] *),
.app-bg-image h2:not([class*="bg-card"] *):not([class*="bg-popover"] *):not([class*="bg-background"] *),
.app-bg-image h3:not([class*="bg-card"] *):not([class*="bg-popover"] *):not([class*="bg-background"] *) {
  color: #fff;
  text-shadow: 0 2px 8px rgba(0,0,0,0.5);
}

/* Texto muted-foreground suelto → blanco semi */
.app-bg-image > main .text-muted-foreground:not([class*="bg-card"] *):not([class*="bg-popover"] *) { 
  color: rgba(255,255,255,0.85) !important; 
}

/* Links sueltos */
.app-bg-image > main a:not([class*="bg-"] *):not(.btn) { 
  color: #93c5fd; 
}
.app-bg-image > main a:not([class*="bg-"] *):hover { color: #fff; }

/* Botones ghost/outline sobre fondo azul */
.app-bg-image button[class*="hover:bg-accent"]:not([class*="bg-card"] *) {
  color: #fff;
  border-color: rgba(255,255,255,0.25);
}
.app-bg-image button[class*="hover:bg-accent"]:hover:not([class*="bg-card"] *) {
  background-color: rgba(255,255,255,0.12) !important;
  color: #fff !important;
}

/* Skeletons sueltos: tono claro para que se vean sobre azul */
.app-bg-image > main .bg-muted:not([class*="bg-card"] *) { 
  background-color: rgba(255,255,255,0.12) !important; 
}
```

**4. Garantizar que cards/dialogs/popovers sigan siendo sólidos blancos (con texto oscuro)**
- Subir `bg-card/95` → `bg-card` en componentes que ya estaban semitransparentes y se vuelven ilegibles sobre azul (revisión puntual).
- Los Dialog/Sheet/Popover ya usan `bg-popover` sólido → ok.

**5. NotFound: alinear al estilo del resto**
- Cambiar `bg-muted` por `AppBackground`, texto blanco, botón outline con bordes blancos.

### Cómo cambiar la imagen en el futuro
Sigue siendo el mismo punto único:
- **`src/assets/app-background.jpg`** (reemplazas el archivo) o
- Cambias el `import appBackground` en **`src/components/layout/AppBackground.tsx`** (ahora la fuente única, ya no en `MainLayout`).

Y para volver a blanco totalmente: **Admin → Site Settings → Toggles → Fondo de la aplicación → Blanco (clásico)** (este toggle ya existe).

### Lo que NO toco
- En Vivo (`LiveStreamView`, `DailyVideoPlayer`, `LivePreviewPlayer`, `LivesGrid`, `LivePlayer`).
- Landing pública (`/`) — ya tiene su gradient azul propio.
- Tokens del design system (`--primary`, `--card`, etc.).
- Lógica de auth, pagos, video, etc.

### Archivos modificados
- **Nuevo:** `src/components/layout/AppBackground.tsx`
- **Editados:** `src/components/layout/MainLayout.tsx` (usa el wrapper), `src/index.css` (reglas reforzadas), `src/pages/Login.tsx`, `src/pages/Onboarding.tsx`, `src/pages/ResetPassword.tsx`, `src/pages/EmailConfirmed.tsx`, `src/pages/RoleSelector.tsx`, `src/pages/VerificationPending.tsx`, `src/pages/AccessDenied.tsx`, `src/pages/NotFound.tsx`

### Resultado final
- **Cero pantallas blancas.** Login/registro/onboarding/reset/404/etc. todas con fondo azul.
- **Contraste real:** títulos blancos con sombra, botones ghost legibles, links visibles, cards/modales con su blanco interno intacto.
- Toggle de admin sigue funcionando para volver a blanco clásico cuando el cliente lo pida.

