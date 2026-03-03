

# Plan: Mejorar visualización de imagen de avatar en perfil

## Problema
La imagen de avatar se ve comprimida/ajustada porque no tiene `object-cover`, lo que causa que la imagen se deforme en lugar de recortarse proporcionalmente.

## Solución

**Archivo**: `src/components/ui/avatar.tsx` (línea 22)

Agregar `object-cover` a la clase de `AvatarImage` para que la imagen se escale proporcionalmente y llene el círculo sin deformarse:

```tsx
// Antes
className={cn("aspect-square h-full w-full", className)}

// Después  
className={cn("aspect-square h-full w-full object-cover", className)}
```

Esto aplica globalmente a todos los avatares de la app, asegurando que cualquier imagen subida se vea bien sin importar sus proporciones originales.

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/ui/avatar.tsx` | Línea 22: agregar `object-cover` a AvatarImage |

