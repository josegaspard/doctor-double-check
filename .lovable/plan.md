

## Fix puntual: botón de perfil del header + sección "¿Cómo funciona?" + iconos del header

### Problemas reales en las capturas

1. **Botón "Fernanda" (perfil) en header**
   - Es `<Button variant="ghost">` con un círculo interno `bg-primary/10` + icono `text-primary`.
   - Sobre el fondo azul oscuro: el círculo `bg-primary/10` queda casi invisible y el texto "Fernanda" se ve apagado.
   - En el screenshot se ve gris/azul oscuro sobre azul oscuro = ilegible.

2. **Sección "¿Cómo funciona?" en `/doctor/profile/...`**
   - Bloque con `bg-muted/30` que sobre el fondo azul se ve como un gris violáceo translúcido feo.
   - Textos `text-muted-foreground` casi invisibles.
   - Números 1️⃣ 2️⃣ 3️⃣ son emojis grises planos sin jerarquía visual.
   - Layout pobre: tres columnas amontonadas, sin separación, sin iconografía real.

3. **Tercer botón del header (idioma 🌐)**
   - El `LanguageSwitcher` está usando una variante con fondo claro y termina con icono también claro = no se ve.

---

## Qué voy a corregir

### 1) Rediseñar el trigger del menú de perfil
Archivo: `src/components/layout/MainLayout.tsx` (líneas 478–492)

Cambios:
- Quitar `variant="ghost"` y darle un estilo propio coherente con el resto del header oscuro:
  - fondo: `bg-white/10` con `border border-white/20`
  - hover: `bg-white/20`
  - texto "Fernanda": blanco sólido (`text-white`)
  - círculo del avatar: fondo blanco translúcido más visible (`bg-white/20`) + icono blanco
- Asegurar que esto **no** caiga en el "safety net" de superficies claras (no usa `bg-white`, `bg-card`, `bg-background` ni `border-input`).
- Mantener el mismo tamaño/espaciado actual para no romper layout.

Resultado: el botón se ve como una "pill" oscura translúcida con texto blanco legible, igual de elegante que el resto del chrome del header.

---

### 2) Rediseñar la sección "¿Cómo funciona?"
Archivo: `src/pages/DoctorProfile.tsx` (líneas 707–727)

Rediseño UX/UI completo:

- Quitar `bg-muted/30` (que se ve sucio sobre azul) y reemplazar por un **card real blanco** con `bg-card` + `border` para que tenga jerarquía propia y contraste limpio.
- Sustituir emojis 1️⃣ 2️⃣ 3️⃣ por **números reales en círculos** con gradiente de marca (`from-[#163a83] to-[#00768b]`), tamaño 40px, blancos.
- Añadir un **icono Lucide** real arriba del título de cada paso:
  - Paso 1 "Seguir": `Bell`
  - Paso 2 "Suscribirse": `Star`
  - Paso 3 "Orientación": `MessageSquare`
- Tipografía:
  - Título sección: `text-base font-semibold text-foreground`
  - Título de paso: `text-sm font-semibold text-foreground`
  - Descripción: `text-xs text-muted-foreground leading-relaxed`
- Layout:
  - En desktop: `grid-cols-3` con divisores verticales sutiles entre pasos
  - En móvil: `grid-cols-1` apilado con separadores horizontales
  - Padding generoso: `p-5`
  - Espacio entre items: `gap-4`
- Resultado: una tarjeta clara, premium, con jerarquía visual real (icono + número + título + descripción), legible siempre y consistente con el resto de cards de la plataforma.

---

### 3) Arreglar el botón del idioma (🌐) en el header
Archivo: `src/components/settings/LanguageSwitcher.tsx`

- Asegurar que el trigger use `variant="ghost"` puro (sin `bg-background`/`bg-card`/`border-input`) cuando vive en el header del shell azul, para que herede correctamente blanco sobre transparente y no caiga en el safety net que lo pinta blanco con icono blanco.
- Dejar tamaño `size="icon"` y mantener accesibilidad (aria-label).
- Verificar contraste: icono blanco sobre fondo translúcido oscuro, hover `bg-white/12`.

---

### 4) Verificación de contraste posterior
- Header desktop: avatar + "Fernanda" legibles, idioma 🌐 visible, búsqueda 🔍 y campana 🔔 visibles.
- `/doctor/profile/:id`: la sección "¿Cómo funciona?" se ve como tarjeta blanca con iconos y números azules de marca, totalmente legible sobre el fondo azul.
- Sin tocar reglas globales de `index.css` (ya están estabilizadas) — solo cambios quirúrgicos en los 3 componentes afectados.

---

## Archivos a tocar
- `src/components/layout/MainLayout.tsx` — botón perfil del header
- `src/components/settings/LanguageSwitcher.tsx` — botón idioma del header
- `src/pages/DoctorProfile.tsx` — sección "¿Cómo funciona?"

---

## Resultado esperado
- **Botón "Fernanda"**: pill oscura translúcida elegante, texto e icono blancos perfectamente legibles.
- **Botón idioma**: icono blanco visible sobre el header azul.
- **"¿Cómo funciona?"**: tarjeta blanca premium con números de marca, iconos reales, jerarquía clara y excelente contraste.

