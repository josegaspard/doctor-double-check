

# Plan: Fallback robusto en badges + Auditoría SEO + QA visual end-to-end

## Parte 1 — Fallback de badges Cédula / COFEPRIS

Endurecer el render para que cualquier valor (vacío, espacios, demasiado largo) nunca rompa layout.

**Archivos:**
- `src/pages/ContentGallery.tsx` (línea ~228–245):
  - Añadir helper `sanitizeCred(v?: string)` que devuelva `string | null`: trim, descarta `''`, `'null'`, `'undefined'`, `'N/A'`. Usar en lugar de comparación directa.
  - Añadir `title={value}` (tooltip nativo) y `max-w-[120px] sm:max-w-[160px]` con `truncate` al `<span>` interior. El `Badge` exterior pasa a `inline-flex items-center max-w-full overflow-hidden`.
- `src/components/content/ContentPreviewModal.tsx` (línea ~315–330):
  - Mismo helper compartido (mover a `src/lib/utils.ts` como `sanitizeCredential`).
  - Envolver el texto en `<span className="truncate max-w-[160px] sm:max-w-[220px]">` con `title={...}`.
  - Aplicar `flex-wrap` ya existente + `min-w-0` al contenedor padre para permitir el truncado real.
- `src/pages/ContentGallery.tsx` `fetchContents` (~321):
  - Pasar valores por `sanitizeCredential` antes de mapearlos para que ya no lleguen valores basura desde DB.

## Parte 2 — Auditoría SEO (verificación de Search Console)

Las herramientas de Lovable no acceden a Google Search Console (requiere propiedad verificada). Lo que sí puedo dejar listo y verificable internamente:

**Mejoras adicionales en `index.html` y `public/robots.txt`:**
- Añadir `<link rel="sitemap" type="application/xml" href="https://medical-masters.com/sitemap.xml" />` en `<head>`.
- Añadir `Sitemap: https://medical-masters.com/sitemap.xml` al final de `public/robots.txt`.
- Crear `public/sitemap.xml` mínimo con las rutas públicas indexables (`/`, `/doctors`, `/lives`, `/content`, `/help`, `/privacy`, `/terms`, `/security`, `/compliance`, `/for-patients`, `/for-doctors`, `/for-residents`, `/enterprise`, `/contact`).
- Añadir `<meta property="og:image:type" content="image/png" />` y `<meta property="og:image:alt" content="Medical Masters logo" />` para evitar warnings de validadores.
- Validar JSON-LD con la regla actual: ya cumple `@context`, `@type`, `name`, `url`, `logo`. Sólo agregar `"telephone"` y `"address"` opcionales si los tienes; si no, dejar como está (válido).

**Lista de verificación para que el usuario corra en Search Console (la entrego como sección final del plan, no la puedo automatizar):**

| Item | Herramienta | URL |
|---|---|---|
| Canonical detectado | URL Inspection Tool | search.google.com/search-console |
| Robots / indexabilidad | Coverage report | mismo |
| Open Graph preview | LinkedIn Post Inspector | linkedin.com/post-inspector |
| OG image absoluta | Facebook Sharing Debugger | developers.facebook.com/tools/debug |
| JSON-LD `MedicalOrganization` | Rich Results Test | search.google.com/test/rich-results |
| Sitemap aceptado | Sitemaps en GSC | mismo |

## Parte 3 — QA visual (mobile + desktop)

Después de aplicar los cambios anteriores, abrir browser preview en 2 viewports y verificar visualmente:

1. **375×812 (mobile)**: ir a `/content` → confirmar que las cards muestran badges Cédula/COFEPRIS truncados, sin desbordar; abrir un item para validar el modal.
2. **1366×768 (desktop)**: misma URL → confirmar que badges entran en una línea y no rompen el layout del card.
3. **`/admin/qa-checklist`**: con sesión admin, confirmar que el dashboard muestra el atajo y que la lista por rol carga.
4. **Menú doctor**: en desktop confirmar que aparecen 6 items + "Más" sin scroll horizontal; en mobile confirmar bottom-nav 4+1 con sheet.

## Parte 4 — Cumplimiento del megaprompt completo

Estado final tras esta entrega:

| Petición original | Estado |
|---|---|
| Cédula + COFEPRIS en lives | ✅ |
| Cédula + COFEPRIS en Contenido Premium con fallback robusto | ✅ (esta entrega) |
| Logo MM en favicon/header/PWA | ✅ |
| Precios solo a pacientes | ✅ |
| Hábitos con frecuencia condicional | ✅ |
| Filtros Todo/Gratis/Comprados en Premium | ✅ |
| Chat sin archivos | ✅ |
| Localizar hospital con Maps + Waze | ✅ |
| "Doctores activos" después de Ubicación | ✅ |
| Vault → "Mis Pacientes" + cobros + azul | ✅ |
| Medical Master Education + chat residentes/doctores | ✅ |
| "Soy Médico" en navegación | ✅ |
| Compartir contenido a ambas audiencias | ✅ |
| Menú adaptable Desktop/Tablet/Mobile | ✅ |
| QA Checklist E2E `/admin/qa-checklist` | ✅ |
| Wallet notifications initiated/paid/failed | ✅ |
| AccessGuard auditable | ✅ |
| Resumen clínico con DRM UX | ✅ |
| SEO: canonical, robots, JSON-LD, OG absoluta | ✅ |
| Sitemap.xml indexable | ✅ (esta entrega) |

**Nada queda en el aire.** Las únicas tareas que requieren acción manual del usuario (no de código) son: dar de alta el dominio en Google Search Console, subir sitemap, y correr Rich Results Test — pasos que documento en una nota tras la implementación.

## Archivos tocados

1. `src/lib/utils.ts` — exporta `sanitizeCredential`
2. `src/pages/ContentGallery.tsx` — usa helper + truncado responsive
3. `src/components/content/ContentPreviewModal.tsx` — usa helper + truncado responsive
4. `index.html` — sitemap link + og:image:alt + og:image:type
5. `public/robots.txt` — Sitemap directive
6. `public/sitemap.xml` — nuevo, con rutas públicas

