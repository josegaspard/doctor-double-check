## Cambiar fondo blanco con círculos por imagen + asegurar contraste

### Qué voy a hacer

**1. Subir tu imagen al proyecto**

- Copiar `46.png` a `src/assets/app-background.jpg` para que quede integrada y optimizada por el bundler.

**2. Reemplazar el fondo decorativo en `MainLayout.tsx**`

- Quitar el componente `<DecorativeBackground />` (es el que dibuja los círculos de colores).
- Cambiar el `bg-gradient-to-br from-primary/[0.02]...` del `<div>` raíz por la imagen importada como background fijo, con `background-size: cover`, `center`, y `attachment: fixed` para que no haga scroll y se vea bien en cualquier tamaño.
- Añadir un overlay sutil oscuro encima de la imagen (ej. `bg-black/30`) para garantizar legibilidad de cards/textos sobre el fondo azul.

**3. Asegurar contraste de textos y botones**

Como tu imagen es azul oscuro degradado a teal, los textos directos sobre el fondo necesitan claridad. Estrategia:

- **Cards/popovers/headers/footer**: ya usan `bg-card`, `bg-background`, `bg-popover` → mantienen su contraste interno (texto oscuro sobre superficie clara). Refuerzo: subir opacidad de `bg-card/95` donde haga falta para que no se transparente la imagen detrás y se vuelva ilegible.
- **Header**: actualmente `bg-card/95` → lo dejo igual, queda blanco translúcido sobre la imagen, perfecto contraste.
- **Bottom nav móvil**: aseguro `bg-card` sólido (sin translucidez agresiva).
- **Textos sueltos sobre el fondo** (títulos de página fuera de cards): repaso pages clave (`/app`, listados, etc.) y donde haya texto directo sobre el `<main>` añado wrapper con `bg-card/80 backdrop-blur` o cambio a `text-white` con `drop-shadow` cuando aplica.
- **Botones**: las variantes (`default`, `secondary`, `outline`, `ghost`) ya tienen tokens de color sólidos, así que se ven bien. Refuerzo `variant="ghost"` que es el más débil con `hover:bg-card/80` para que no se pierda sobre el fondo.

**4. Dejarte documentado dónde cambiar la imagen en el futuro**

Para cambiar la imagen después solo abres `**src/assets/app-background.jpg**` y la reemplazas por otra con el mismo nombre, o:

- Sustituyes el archivo en `src/assets/`
- O cambias el `import appBackground from '@/assets/app-background.jpg'` en `src/components/layout/MainLayout.tsx` (línea cerca de los otros imports de logos) por la nueva ruta.

### Archivos que voy a tocar

- `src/assets/app-background.jpg` (nuevo, copia de tu upload)
- `src/components/layout/MainLayout.tsx` (quitar `DecorativeBackground`, aplicar imagen + overlay)
- `src/components/layout/DecorativeBackground.tsx` (lo dejo en disco pero ya no se usa; si prefieres lo borro)
- `src/index.css` (pequeño ajuste si hace falta una utilidad `.app-bg` reutilizable, opcional)

### Lo que NO voy a tocar

- Nada del flujo de En Vivo (`LiveStreamView`, `DailyVideoPlayer`, `LivePreviewPlayer`, etc.).
- Nada de `LandingFooter` / página `/` pública (esa tiene su propio diseño).
- Tokens de color del design system (los mantengo intactos).

### Resultado

- Toda la app autenticada (`/app`, `/lives`, `/recordings`, `/chat`, `/wallet`, etc.) carga con tu imagen azul como fondo fijo.
- Cards, header, bottom nav y modales mantienen contraste perfecto.
- El flujo de En Vivo se conserva idéntico.
- Para cambiar la imagen luego: reemplaza `src/assets/app-background.jpg`.

Perfecto, ahora quiero que guardes esta parte como un commit o le pongas nombre a cómo esta ahora antes de la imagen para que en algún momento que mi cliente quiera volver a blanco, todo vuelva a como esta ahora, o si no agrega una parte del super administrador 