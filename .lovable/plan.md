## Problema
El número dentro de la bolita roja de notificaciones se ve oscuro porque la variante `destructive` del Badge aplica `text-destructive-foreground` (que en el theme actual resuelve a un tono oscuro), y eso le gana al `text-white` que ya estaba puesto.

## Cambio
Archivo único: `src/components/notifications/NotificationBell.tsx`

En el `<Badge>` del contador:
- Cambiar `text-white` por `!text-white` (con `!` de Tailwind) para que sobreescriba el `text-destructive-foreground` de la variante.
- Mantener `font-bold`, borde y sombra existentes.

Resultado: el número (`1`, `2`, … `9+`) se renderiza en blanco puro sobre el fondo rojo, legible al 100%.

No se toca nada más.