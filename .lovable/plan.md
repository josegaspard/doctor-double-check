

# Plan: Mejorar layout de botones en perfil del doctor

## Problema actual

La sección de acciones (líneas 588-637 de `DoctorProfile.tsx`) usa `grid-cols-[1fr_1fr_auto]` para la fila secundaria. Cuando el usuario está suscrito, el `SubscribeButton` renderiza **dos botones** ("Suscrito" + "Suscripción Pro") dentro de un `flex` container, que se desborda del `1fr` asignado. En móvil, los textos se truncan y el botón "Ver Lives" queda cortado.

## Solución

Reorganizar la sección de acciones con un layout adaptativo por breakpoint:

### `src/pages/DoctorProfile.tsx` — Sección de acciones (líneas 588-637)

**Móvil (< sm):**
- Primary CTA: "Iniciar Orientación" a ancho completo (sin cambio)
- SubscribeButton: fila completa propia (`w-full`)
- "Ver Lives" + "Bloquear": fila de 2 columnas `grid-cols-[1fr_auto]`

**Tablet/Desktop (sm+):**
- Primary CTA: ancho completo (sin cambio)
- Fila secundaria: `grid-cols-[1fr_1fr_auto]` como ahora, pero solo cuando hay espacio

```text
┌─────────────────────────────────┐
│  📩 Iniciar Orientación         │  ← full width always
├─────────────────────────────────┤
│  ✓ Suscrito  │ 👑 Suscripción Pro │  ← mobile: full row
├──────────────┬──────────────────┤
│  🎬 Ver Lives │  🚫              │  ← mobile: own row
└──────────────┴──────────────────┘

Desktop/Tablet:
┌─────────────────────────────────────┐
│  📩 Iniciar Orientación              │
├────────────┬────────────┬───────────┤
│ Subscribe  │ Ver Lives  │  🚫       │
└────────────┴────────────┴───────────┘
```

### `src/components/subscriptions/SubscribeButton.tsx` — Layout del estado suscrito (línea 164)

Cambiar el wrapper `flex` del estado suscrito para que en contextos estrechos apile los botones verticalmente:
- Agregar `flex-wrap` para que "Suscripción Pro" baje a otra línea si no cabe
- En el contexto del perfil, usar `flex-col sm:flex-row` para apilar en móvil

## Cambios específicos

### 1. `src/pages/DoctorProfile.tsx`
- Reemplazar `grid-cols-[1fr_1fr_auto]` por un layout apilado en móvil:
  - Wrap en `flex flex-col gap-2 sm:grid sm:grid-cols-[1fr_1fr_auto] sm:gap-2`
  - SubscribeButton ocupa ancho completo en móvil
  - "Ver Lives" + "Bloquear" en su propia fila en móvil con `flex gap-2`

### 2. `src/components/subscriptions/SubscribeButton.tsx`
- Línea 164: agregar `flex-wrap` al container del estado suscrito
- Los dos botones ("Suscrito" y "Suscripción Pro") podrán fluir a nueva línea si no caben

## Archivos a modificar
1. `src/pages/DoctorProfile.tsx` — Layout responsivo de acciones
2. `src/components/subscriptions/SubscribeButton.tsx` — flex-wrap en estado suscrito

