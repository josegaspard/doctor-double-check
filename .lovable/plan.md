
## Cierre final de contraste y eliminación total de barras blancas

### Problemas que siguen vivos
1. **La barra/blanco en login-register sigue apareciendo** porque todavía hay pantallas standalone con `header`/`footer` en `bg-card` o con `border-border` visible sobre el fondo azul:
   - `ResetPassword.tsx`
   - `Onboarding.tsx`
   - `RoleSelector.tsx` (footer con borde)
   - estados derivados de auth/registro
2. **Hay hover y estados activos con contraste roto**:
   - `ghost`, `outline`, `link`
   - tabs (`TabsTrigger`) y pills activas
   - iconos dentro de botones blancos o fondos claros
3. **Footer aún se ve apagado**:
   - links en `text-slate-400`
   - iconos sociales con poco contraste antes del hover
   - copy secundaria demasiado tenue
4. **Las reglas globales actuales en `index.css` ayudan, pero no cubren bien estados interactivos reales** y en algunos casos generan conflicto visual entre fondo blanco + texto blanco.

---

## Qué voy a corregir

### 1) Quitar cualquier rastro de blanco/línea en auth y pantallas standalone
Voy a unificar el chrome de las pantallas con fondo azul para que ninguna vuelva a meter una franja clara:

- `Login.tsx`: revisar header y tabs del login/register para que no aparezca ninguna banda blanca ni pill ilegible.
- `ResetPassword.tsx`: cambiar ambos headers `bg-card` + `border-border` por header oscuro igual al fondo/footer.
- `Onboarding.tsx`: cambiar los headers `bg-card/95 backdrop-blur` y footer `bg-card` por versión oscura sin borde visible.
- `RoleSelector.tsx`: quitar el borde superior del footer y reforzar textos.
- `RoleSelector.tsx` loading state: usar también `AppBackground` para que no exista ni un flash blanco.
- Revisar `EmailConfirmed`, `VerificationPending`, `NotFound` para asegurar que sus botones/íconos/estados sigan legibles sobre azul.

Resultado: **cero barra blanca en login, register, reset, onboarding y estados de auth**.

---

### 2) Endurecer el sistema global de contraste con lógica de UX/UI real
No solo “más blanco”; voy a ordenar el sistema por tipo de superficie:

#### A. Superficies oscuras sobre fondo azul
Para elementos que viven directo sobre el fondo:
- títulos: blanco sólido
- subtítulos: blanco 80–88%
- links: celeste claro con hover blanco
- bordes: blanco translúcido
- iconos: blanco 85–92%

#### B. Superficies claras
Para botones/pills/tabs activos blancos o casi blancos:
- texto e iconos pasarán a **azul oscuro sólido**
- hover mantendrá contraste alto, nunca icono blanco sobre fondo blanco
- focus visible también tendrá ring perceptible

#### C. Estados interactivos
Voy a cubrir explícitamente:
- default
- hover
- active
- selected
- focus-visible
- disabled

Así se corrige exactamente lo que reportaste: **no más icono blanco sobre botón blanco ni texto lavado en hover**.

---

### 3) Corregir botones globalmente, no parche por parche
Voy a ajustar `src/components/ui/button.tsx` y complementar con CSS scoped en `.app-bg-image`:

#### `ghost`
- estado base sobre fondo azul: texto/icono blanco o blanco suave
- hover: fondo blanco translúcido + texto blanco
- cuando el botón esté sobre superficie clara, seguirá respetando el sistema actual

#### `outline`
- sobre fondo azul: borde blanco translúcido + texto blanco
- hover: fondo blanco suave pero **texto/icono azul oscuro**
- esto evita exactamente el problema de “icono blanco con fondo blanco”

#### `link`
- en fondo azul: celeste claro
- hover: blanco con mejor legibilidad

#### botones activos/selected tipo pill
- fondo blanco o claro: texto/icono azul oscuro
- fondo oscuro: texto/icono blanco

---

### 4) Corregir tabs, pills y triggers activos
El problema visual de pills/tabs activas viene de la mezcla entre reglas globales y estilos Radix/Tailwind.

Voy a ajustar:
- `src/components/ui/tabs.tsx`
- bloque `.app-bg-image` en `src/index.css`

Para que:
- `TabsList` tenga fondo translúcido oscuro/claro consistente
- `TabsTrigger` inactivo = blanco suave legible
- `TabsTrigger` activo = fondo blanco y texto/icono azul oscuro
- hover del inactivo = subir contraste
- login/register y cualquier tabs de la app queden coherentes

Esto cubre también chips tipo selector que ahora se ven “lavados”.

---

### 5) Mejorar iconografía global
Voy a reforzar contraste de iconos en tres contextos:

1. **Iconos sueltos sobre fondo azul**
   - blanco 90%

2. **Iconos dentro de botones oscuros**
   - heredan blanco o celeste claro

3. **Iconos dentro de botones/pills claras**
   - azul oscuro sólido

Incluye:
- iconos de navegación
- iconos en botones outline/ghost
- iconos de footer/social
- iconos en headers standalone
- iconos de tabs y pills activas

---

### 6) Subir contraste del footer completo
En `src/components/layout/UnifiedFooter.tsx` voy a mejorar:

- títulos de columnas: mantener blancos fuertes
- links normales: subir de `slate-400` a un tono más visible
- hover: blanco pleno
- descripción institucional: subir contraste
- copyright: menos apagado
- iconos sociales:
  - fondo más visible desde reposo
  - iconos con contraste alto desde reposo
  - hover más evidente sin perder elegancia

Resultado: **footer legible incluso con imagen azul/celeste detrás y en móvil**.

---

### 7) Ajustes finos en `index.css` para evitar conflictos
Voy a reescribir parte del bloque `.app-bg-image` para que sea menos ambiguo y más robusto:

- separar reglas para:
  - texto
  - links
  - iconos
  - botones ghost
  - botones outline
  - tabs
  - badges
  - inputs/selects
  - footer
  - headers standalone
- añadir reglas específicas para elementos activos con fondo claro
- evitar que una regla global vuelva blanco un texto dentro de una pill blanca

---

## Archivos a tocar
- `src/index.css`
- `src/components/ui/button.tsx`
- `src/components/ui/tabs.tsx`
- `src/components/layout/UnifiedFooter.tsx`
- `src/pages/Login.tsx`
- `src/pages/ResetPassword.tsx`
- `src/pages/Onboarding.tsx`
- `src/pages/RoleSelector.tsx`
- `src/pages/EmailConfirmed.tsx`
- `src/pages/VerificationPending.tsx`
- `src/pages/NotFound.tsx`

---

## Resultado final esperado
- **Desaparece la barra blanca** en login/register y demás pantallas de auth
- **Cero blanco accidental** en headers/footers standalone
- **Hover de botones corregido**
- **Pills/tabs activas legibles**
- **Iconos visibles antes y durante hover**
- **Footer mucho más claro y premium**
- **Contraste tipo “modo noche” real** en toda la plataforma, desktop y móvil

---

## Detalle técnico
La implementación seguirá esta regla UX principal:

```text
Fondo oscuro  -> texto/icono claro
Fondo claro   -> texto/icono oscuro
Hover nunca puede reducir contraste
Selected nunca puede dejar blanco sobre blanco
```

Y dejaré la lógica centralizada para que futuras pantallas nuevas hereden el comportamiento automáticamente en vez de volver a romper contraste.
