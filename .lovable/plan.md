

# Fix: "nav.advertising" mostrándose como texto en lugar de "Publicidad"

## Problema

La función `t()` en `src/lib/i18n.ts` retorna el path (`"nav.advertising"`) cuando no encuentra la traducción, en lugar de retornar algo falsy. Por eso el fallback `|| 'Publicidad'` nunca se ejecuta y se muestra el texto técnico "nav.advertising".

La clave `advertising` existe en `ads.advertising` pero no en `nav.advertising`.

## Solución

Dos cambios mínimos:

### 1. `src/lib/i18n/es.ts` — Añadir la clave al objeto `nav`
Línea 26, antes de `more`: añadir `advertising: 'Publicidad',`

### 2. `src/lib/i18n/en.ts` — Igual para inglés
Añadir `advertising: 'Advertising',` en el objeto `nav`.

Con esto, `t('nav.advertising')` retornará correctamente "Publicidad" en español y "Advertising" en inglés, y no se mostrará ningún término técnico.

## Archivos a modificar
- `src/lib/i18n/es.ts` — 1 línea
- `src/lib/i18n/en.ts` — 1 línea

