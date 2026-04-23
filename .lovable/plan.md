
## Corrección UX/UI real: contraste lógico, no overrides ciegos

### Problemas confirmados en las capturas
1. **Header / avatar / wallet / acciones**: hay reglas globales en `src/index.css` que siguen forzando blanco dentro del chrome azul y terminan chocando con controles claros. Resultado: iconos o texto invisibles cuando el fondo del control es blanco o casi blanco.
2. **Tabs y pills activas**: varios estados activos usan fondo blanco (`bg-background`) pero el texto/icono sigue heredando blanco. Se ve en:
   - pill de `Expediente Médico`
   - chips `Público / Privado / Clínica`
3. **Footer**: el texto base sigue demasiado gris para un fondo azul oscuro. También los iconos sociales tienen contraste insuficiente en reposo.
4. **Barra/línea oscura o blanca en shells standalone**: aún hay piezas que usan header/footer móvil o bordes heredados (`MobileBackHeader`, separadores, border classes) y rompen la continuidad del fondo.
5. **Arquitectura CSS**: hoy hay demasiadas reglas globales por `header button`, `header a`, `role=tab`, etc. Eso produce efectos secundarios. La solución debe pasar de “pinta todo de blanco” a “decide color según la superficie”.

---

## Regla maestra que voy a imponer
```text
Superficie oscura/transparente sobre fondo azul -> texto/iconos blancos
Superficie clara (white, bg-background, bg-card, pill activa) -> texto/iconos #0b1d45
Hover nunca puede bajar contraste
Selected nunca puede dejar blanco sobre blanco
Iconos siempre heredan el color correcto del estado
```

---

## Qué voy a rehacer

### 1) Reescribir la lógica del header para separar controles oscuros vs controles claros
En vez de reglas tipo:
- “todo lo del header = blanco”

voy a crear dos contextos explícitos:

#### A. Shell actions transparentes
Ejemplos:
- menú
- search trigger
- language switcher ghost
- notification bell
- user menu trigger si vive sobre fondo azul

Estado:
- texto/iconos blanco 90%
- hover `bg-white/12`
- iconos blancos siempre

#### B. Surface actions claras
Ejemplos:
- botón wallet
- pills claras dentro del header
- cualquier `outline`/`bg-white` del header

Estado:
- fondo claro sólido
- texto/iconos `#0b1d45`
- hover `bg-slate-100` con texto/iconos `#0b1d45`
- sin ninguna regla global que vuelva a pintarlos blancos

**Archivos:**
- `src/index.css`
- `src/components/layout/MainLayout.tsx`
- `src/components/settings/LanguageSwitcher.tsx`
- `src/components/notifications/NotificationBell.tsx`
- `src/components/search/GlobalSearch.tsx`

---

### 2) Corregir el botón wallet y los iconos del header con clases semánticas, no hacks
Voy a dejar de confiar en el “safety net” genérico y voy a poner clases explícitas para superficies claras del header, por ejemplo una clase tipo:
- `app-header-surface-button`

Esa clase controlará:
- color base
- iconos
- hover
- focus
- disabled

Así el botón wallet no volverá a romperse aunque cambie el CSS global.

**Archivo principal:**
- `src/components/layout/MainLayout.tsx`

---

### 3) Rehacer `button.tsx` con comportamiento UX correcto
Voy a corregir los variants globales para que ya nazcan con buena lógica:

#### `outline`
- base: superficie clara + texto/icono oscuro
- hover: sigue oscuro, nunca blanco sobre blanco

#### `ghost`
- base: hereda contexto
- en shell azul: claro
- sobre hover claro: si el fondo se aclara demasiado, cambia texto/icono a oscuro cuando corresponda

#### `link`
- sobre azul: cyan claro
- hover: blanco
- dentro de cards: mantiene contraste del sistema

Además voy a reforzar herencia de color de `svg` para que los iconos sigan al texto del botón, no un color viejo.

**Archivo:**
- `src/components/ui/button.tsx`

---

### 4) Rehacer tabs/pills/selected states para que el activo oscuro-claro sea infalible
Las capturas muestran el fallo exacto: un pill activo blanco con texto/icono demasiado claro.

Voy a ajustar:
- `src/components/ui/tabs.tsx`
- `src/index.css`

Para que:
- inactivo sobre azul: blanco 80–90%
- hover inactivo: sube contraste
- activo: `bg-white` o `bg-background` + texto/iconos `#0b1d45`
- cualquier `svg` dentro de `data-state="active"` también se fuerza a oscuro

Esto cubrirá:
- login/register
- chips de navegación
- pills tipo `Expediente Médico`
- cualquier selector horizontal tipo hospital locator

---

### 5) Corregir específicamente los chips del Hospital Locator
Tus capturas enseñan que `Público / Privado / Clínica` no se leen bien. Aquí no basta CSS global; esos chips usan colores por item.

Voy a corregir su sistema así:
- **inactivos sobre azul**: fondo translúcido oscuro + texto blanco
- **activos claros**: fondo claro, pero el texto no será blanco; se pondrá oscuro
- conservar la codificación visual:
  - Público = acento azul
  - Privado = acento púrpura
  - Clínica = acento teal
- el color de tipo se usará como detalle de borde/halo/icono, no como una combinación que destruya legibilidad

**Archivo:**
- `src/pages/HospitalLocator.tsx`

---

### 6) Corregir el header móvil secundario que sigue metiendo una barra separada
Hay una capa extra en `src/components/layout/MobileBackHeader.tsx`:
- `border-b border-border bg-card/95 backdrop-blur`

Eso introduce una franja distinta al fondo azul y rompe continuidad visual.

Voy a:
- integrarlo al shell azul cuando el fondo imagen está activo
- quitar el borde visible
- mantener título y botón atrás con contraste alto

**Archivo:**
- `src/components/layout/MobileBackHeader.tsx`

---

### 7) Subir contraste del footer completo
Tus capturas lo confirman: el footer aún está gris.

Voy a subir contraste de forma global y consistente:

#### Texto
- títulos columnas: blanco fuerte
- descripción institucional: blanco 88–92%
- links: blanco 86–90% en reposo
- hover: blanco puro
- copyright: blanco 80–85%

#### Iconos sociales
- reposo: borde y fondo visibles, icono blanco fuerte
- hover: fondo blanco + icono azul oscuro
- nunca blanco sobre blanco

#### Badge de estado
- mantener verde, pero con más contraste respecto al azul base

**Archivo:**
- `src/components/layout/UnifiedFooter.tsx`

---

### 8) Limpiar `index.css` para que deje de pelear con la UI
Voy a sustituir parte de los overrides ambiguos por una arquitectura por contexto:

#### Nuevas zonas
- `app-header-chrome`
- `app-header-surface`
- `app-shell-icon-button`
- `app-surface-active`
- `app-footer-link`
- `app-footer-social`

#### Qué se elimina o reduce
- selectores demasiado amplios como:
  - `.app-bg-image > header button...`
  - `.app-bg-image > main [role="tab"]...`
  - reglas que pintan todo `*` dentro de botones claros

#### Qué se mantiene
- reglas útiles para títulos, links y texto suelto sobre la imagen
- fallback de contraste sobre el fondo azul

Resultado: menos choques y más lógica real por superficie.

**Archivo central:**
- `src/index.css`

---

## Archivos a tocar
- `src/index.css`
- `src/components/layout/MainLayout.tsx`
- `src/components/layout/MobileBackHeader.tsx`
- `src/components/layout/UnifiedFooter.tsx`
- `src/components/settings/LanguageSwitcher.tsx`
- `src/components/notifications/NotificationBell.tsx`
- `src/components/search/GlobalSearch.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/tabs.tsx`
- `src/pages/HospitalLocator.tsx`

---

## QA que voy a cerrar después de implementar
1. **Header desktop**
   - wallet siempre oscuro sobre fondo claro
   - iconos visibles en reposo y hover
   - avatar / user trigger sin iconos perdidos

2. **Header móvil**
   - cero barra separada
   - back header integrado al fondo azul

3. **Tabs / pills**
   - `Expediente Médico` activo legible
   - `Público / Privado / Clínica` legibles en todos los estados
   - iconos y emojis visibles

4. **Footer**
   - todos los textos más blancos
   - links visibles sin hover
   - iconos sociales visibles antes del hover

5. **Hover global**
   - ningún botón termina con icono blanco sobre fondo blanco
   - ningún hover reduce contraste

---

## Resultado final esperado
- contraste lógico y consistente en toda la app
- wallet, pills y tabs activas dejan de romperse
- iconos siempre visibles según el color real del fondo
- footer claramente más blanco y legible
- cero barras o capas visuales que corten el fondo azul
- comportamiento tipo “modo noche” real, no un parche de CSS global
