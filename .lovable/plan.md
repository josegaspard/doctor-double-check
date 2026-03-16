

# Fix: Menú desktop cortado + Chat de grabaciones sin scroll

## Problema 1: Menú desktop no muestra todos los items

La barra de navegación para doctores tiene ~13 items con texto que no caben en pantallas de ~1385px. Los items tienen `text-[11px] lg:text-xs xl:text-sm` y padding `px-1.5 lg:px-2 xl:px-2.5` — aún es demasiado grande.

### Solución
En `src/components/layout/MainLayout.tsx` línea 378:
- Reducir tamaño de fuente a `text-[10px] lg:text-[11px] xl:text-xs` 
- Reducir padding a `px-1 lg:px-1.5 xl:px-2`
- Reducir gap entre items de `gap-px` a `gap-0`
- Ocultar iconos incluso en 2xl si hay muchos items (ya están hidden hasta 2xl, mantener)

## Problema 2: Chat de grabaciones no tiene scroll visible

En `RecordingChatReplay.tsx`, el contenedor tiene `maxHeight: 400` pero el `ScrollArea` no tiene una altura fija explícita — el contenido se desborda o no permite scroll visible.

### Solución
En `src/components/recordings/RecordingChatReplay.tsx`:
- Cambiar el contenedor principal: añadir `h-[400px]` en vez de `style={{ maxHeight: 400 }}`
- Asegurar que `ScrollArea` tenga `className="flex-1 min-h-0 overflow-hidden p-2 sm:p-3"` con height explícita
- Añadir `h-full` al ScrollArea para que ocupe el espacio disponible y permita scroll interno

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/layout/MainLayout.tsx` | Líneas 370, 378: reducir tamaño de texto y padding en nav desktop |
| `src/components/recordings/RecordingChatReplay.tsx` | Línea 74, 85: fix altura del contenedor y ScrollArea para scroll correcto |

