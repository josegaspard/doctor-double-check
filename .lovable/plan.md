
# Plan: Agregar Lives y Noticias al header de desktop/tablet para visitantes

## Problema
En PC y tablet, cuando no estas logueado, el header de navegacion aparece vacio porque `filteredNavItems` usa `role && ...` que retorna vacio cuando `role` es `undefined` (no logueado).

## Solucion

**Archivo**: `src/components/layout/MainLayout.tsx` (linea 210-212)

Cambiar la logica de filtrado para que cuando `role` sea falsy, lo trate como `'visitor'`:

```
const filteredNavItems = useMemo(() => {
  const effectiveRole = role || 'visitor';
  return navItems.filter(item => item.roles.includes(effectiveRole));
}, [role]);
```

Esto hara que en desktop/tablet aparezcan "Lives" y "Noticias" en el header cuando el usuario no esta logueado, ya que ambos items tienen `'visitor'` en sus roles.

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/layout/MainLayout.tsx` | Linea 210-212: usar `role \|\| 'visitor'` en filteredNavItems |
