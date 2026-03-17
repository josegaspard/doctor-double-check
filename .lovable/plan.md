

# Plan: Unificar footer en Landing y Login

## Problema
- `Landing.tsx` (líneas 541-597) tiene un footer **hardcodeado** con solo 3 iconos sociales (LinkedIn, Twitter, Instagram) sin usar datos dinámicos, sin badges de App Store/Google Play, sin links administrables.
- `Login.tsx` (líneas 479-496) tiene un footer **mínimo** con solo 2 links (Terms, Privacy) y copyright.
- Ambos deberían usar `<LandingFooter />` (que usa `UnifiedFooter variant="landing"`) para tener el footer completo, idéntico al de las páginas internas.

## Cambios

### 1. `src/pages/Landing.tsx`
- Eliminar todo el bloque de footer hardcodeado (líneas 541-597)
- Importar y usar `<LandingFooter />` en su lugar
- Eliminar imports no usados (`Linkedin`, `Twitter`, `Instagram` si ya no se usan en otro lado del archivo)

### 2. `src/pages/Login.tsx`
- Reemplazar el footer mínimo (líneas 479-496) por `<LandingFooter />`
- Importar `LandingFooter`

## Resultado
Todas las páginas (landing, login, internas, app) mostrarán el mismo footer completo con:
- Logo
- Descripción de marca
- Iconos sociales (dinámicos desde base de datos)
- Badges App Store / Google Play con colores oficiales
- Links de Plataforma, Recursos, Legal (administrables)
- Copyright y status badge

## Archivos a modificar
1. `src/pages/Landing.tsx`
2. `src/pages/Login.tsx`

