
## Corrección global real: contraste con lógica + eliminación de blancos accidentales

### Objetivo
Dejar la app con una lógica visual consistente sobre el fondo azul/celeste:

```text
Fondo oscuro -> texto/iconos claros
Superficie clara -> texto/iconos oscuros
Hover nunca baja contraste
Selected nunca puede terminar blanco sobre blanco
```

### Problemas reales detectados
1. **El header está forzando blanco a todos los botones y links** dentro de `.app-bg-image > header`, incluyendo botones `outline` con fondo blanco. Por eso aparecen casos como:
   - botón de wallet con fondo blanco + icono/texto blanco
   - hover roto en acciones del header
2. **Los tabs/pills activos usan `bg-background`**, no `bg-white`, así que el “safety net” actual no los corrige cuando quedan con fondo claro.
3. **El contraste está resuelto con reglas demasiado globales y ambiguas** en `src/index.css`, lo que genera conflictos entre:
   - header/nav
   - botones outline/ghost
   - tabs activos
   - iconos dentro de superficies claras
4. **Login/register y pantallas standalone aún mezclan shells oscuros con componentes claros sin una jerarquía clara**, así que siguen apareciendo barras/pills/blancos que se sienten como errores.
5. **Footer**: links, copy secundaria e iconos siguen demasiado tenues para un fondo azul con imagen.

---

## Qué voy a rehacer

### 1) Rehacer la arquitectura de contraste del fondo azul
Voy a dejar de “pintar todo de blanco” por selector global y lo voy a separar por contexto:

#### A. Chrome oscuro
Aplica a:
- header
- bottom nav
- footer
- shells standalone

Reglas:
- texto: blanco o blanco 80–90%
- iconos: blanco 88–92%
- hover: blanco pleno o fondo translúcido claro
- nunca usar texto blanco si el control ya tiene fondo blanco

#### B. Superficies claras
Aplica a:
- botones outline con fondo claro
- tabs/pills activas
- chips/blobs blancos
- badges claros
- cualquier botón con `bg-background`, `bg-card`, `bg-white`

Reglas:
- texto e iconos: `#0b1d45`
- hover: mantiene texto oscuro
- focus/selected: también oscuro

#### C. Contenido suelto sobre la imagen
Aplica a:
- títulos
- subtítulos
- textos de apoyo
- links
- iconos sueltos
- separadores

Reglas:
- títulos blancos sólidos con sombra sutil
- subtítulos blanco 80–86%
- links cyan claro con hover blanco
- bordes/separadores blancos translúcidos

---

### 2) Corregir el header para que no rompa botones claros
En lugar de esta lógica actual:
- “todo botón en header = blanco”

voy a dividirlo en dos tipos:

#### Controles transparentes del shell
Ejemplos:
- botón atrás
- language switcher cuando es ghost
- acciones transparentes del shell

Se verán:
- texto/iconos blancos
- hover translúcido claro

#### Controles claros dentro del shell
Ejemplos:
- botón de wallet del header
- pills claras
- botones outline visibles dentro del header

Se verán:
- fondo claro
- texto/iconos oscuros desde reposo
- hover con misma lógica oscura

Esto corrige directamente el error del screenshot del wallet.

**Archivos:**
- `src/index.css`
- `src/components/layout/MainLayout.tsx`
- `src/components/settings/LanguageSwitcher.tsx`

---

### 3) Rehacer `button.tsx` con lógica UX/UI correcta
Voy a ajustar los variantes globales para que no dependan de hacks posteriores:

#### `outline`
- base normal: superficie clara con texto/icono oscuro
- sobre fondo azul: borde visible, fondo claro controlado, texto oscuro si la superficie es clara
- hover: jamás icono blanco sobre fondo blanco

#### `ghost`
- sobre fondo azul: texto/icono claro
- hover: translúcido, sin volverse ilegible
- sobre superficies claras: conserva contraste oscuro

#### `link`
- sobre azul: cyan claro
- hover: blanco
- en cards/modales: conserva contraste normal del sistema

**Archivo:**
- `src/components/ui/button.tsx`

---

### 4) Arreglar tabs, pills y estados selected
Voy a reforzar la lógica de tabs para que cualquier estado activo con fondo claro fuerce texto/icono oscuro.

Esto cubre:
- login / register
- pills del header o vistas horizontales
- cualquier selector con `data-state="active"`
- blobs como el de “Contenido Premium” del screenshot

Reglas:
- inactivo: texto claro sobre oscuro
- hover inactivo: sube contraste
- activo: fondo claro + texto/icono oscuro
- iconos dentro del activo: oscuros también

**Archivos:**
- `src/components/ui/tabs.tsx`
- `src/index.css`

---

### 5) Eliminar de verdad las “barras blancas” en auth/standalone
Voy a unificar el shell visual de estas pantallas para que ninguna vuelva a meter bandas claras o separaciones que parezcan errores:

- `src/pages/Login.tsx`
- `src/pages/ResetPassword.tsx`
- `src/pages/Onboarding.tsx`
- `src/pages/RoleSelector.tsx`
- `src/pages/EmailConfirmed.tsx`
- `src/pages/VerificationPending.tsx`
- `src/pages/NotFound.tsx`

Trabajo concreto:
- revisar header/footer/shell wrappers
- quitar cualquier borde superior/inferior visible que corte la imagen
- asegurar que tabs y CTAs de auth usen la nueva lógica de contraste
- mantener cards/modales internos legibles sin contaminar el shell global

---

### 6) Mejorar iconos globalmente
Voy a aplicar una regla clara para iconografía:

1. **Iconos sobre fondo azul**
   - blanco 90%

2. **Iconos dentro de superficies claras**
   - azul oscuro sólido

3. **Iconos dentro de botones hover/selected**
   - heredan el color correcto del estado
   - nunca quedan “blancos por arrastre” si el fondo ya es claro

Esto cubrirá:
- iconos del header
- iconos de wallet
- iconos de tabs
- iconos sociales del footer
- iconos en auth shells

---

### 7) Subir contraste del footer completo
Voy a rehacer el contraste del footer sin perder estilo premium:

- títulos de columnas: blanco fuerte
- links: subir de tono base para que se lean sin hover
- hover: blanco pleno
- descripción institucional: más presencia
- copyright: menos apagado
- iconos sociales:
  - visibles ya en reposo
  - fondo/borde definidos
  - hover con inversión correcta
  - nunca icono blanco sobre fondo blanco

**Archivo:**
- `src/components/layout/UnifiedFooter.tsx`

---

### 8) Ajustar el bloque `.app-bg-image` para que deje de pelearse con la UI
Voy a limpiar `src/index.css` y separar reglas por tipo de elemento, en vez de usar overrides ambiguos:

- header shell
- footer shell
- texto suelto
- links
- iconos
- outline
- ghost
- tabs/pills activas
- inputs/selects
- badges
- separators
- safety net para superficies claras

También voy a ampliar el “safety net” para cubrir no solo `bg-white`, sino también:
- `bg-background`
- `bg-card`
- estados activos/selected que pinten claro

Así ya no se escapan componentes como el pill blanco con texto blanco.

---

## Archivos a tocar
- `src/index.css`
- `src/components/ui/button.tsx`
- `src/components/ui/tabs.tsx`
- `src/components/layout/MainLayout.tsx`
- `src/components/layout/UnifiedFooter.tsx`
- `src/components/settings/LanguageSwitcher.tsx`
- `src/pages/Login.tsx`
- `src/pages/ResetPassword.tsx`
- `src/pages/Onboarding.tsx`
- `src/pages/RoleSelector.tsx`
- `src/pages/EmailConfirmed.tsx`
- `src/pages/VerificationPending.tsx`
- `src/pages/NotFound.tsx`

---

## QA que voy a dejar cerrada
Después de implementarlo, voy a verificar específicamente:

1. **Login/Register**
   - cero barra o banda blanca accidental
   - tabs activas legibles
   - botones y hover correctos

2. **Header global**
   - wallet button con icono/texto visibles
   - hover correcto en acciones del header
   - ningún botón claro con texto blanco

3. **Footer**
   - links visibles en reposo
   - iconos sociales visibles antes del hover
   - copy secundaria legible

4. **Móvil**
   - fondo continuo
   - bottom nav con contraste correcto
   - pills, tabs y botones legibles

---

## Resultado esperado
- desaparecen las barras/blancos accidentales
- el botón de wallet y cualquier control claro dejan de romperse
- tabs y pills activas quedan legibles
- iconos visibles en todos los estados
- footer mucho más claro y premium
- toda la app hereda una lógica visual coherente tipo “modo noche” real, no parches aislados
