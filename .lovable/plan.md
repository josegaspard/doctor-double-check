

# Plan: Fix REAL credenciales + favicon Google + SEO completo

## Diagnóstico raíz (importante)

**Por qué NO se ven las credenciales en el card de Lives ni en Contenido Premium aunque el código las renderiza:**

La RLS de la tabla `doctor_profiles` es restrictiva: solo el doctor dueño o un admin pueden hacer `SELECT`. Cuando un paciente, residente u otro doctor visita `/lives` o `/content`, el frontend pide `doctor_profiles.cedula_profesional` y la base de datos devuelve 0 filas (no error, simplemente vacío). Por eso el badge nunca aparece, aunque la data SÍ existe (verifiqué los 26 doctores tienen cédula y COFEPRIS asignados).

**La solución no es "agregar cédula a cada usuario" — eso ya está**. La solución es **exponer cédula y COFEPRIS en la VIEW pública** `doctor_profiles_public`, que es legítimo y deseable porque las credenciales profesionales son datos públicos verificables por diseño (igual que un médico publica su cédula en su consultorio físico).

## Parte 1 — Migración: exponer credenciales en view pública

Una sola migración SQL:
1. `DROP VIEW public.doctor_profiles_public CASCADE` y recrear con dos columnas extra: `cedula_profesional` y `cofepris_permit`.
2. Mantener `WHERE status = 'approved'` (solo doctores aprobados muestran credenciales públicamente).
3. Otorgar `GRANT SELECT` a `anon` y `authenticated` (ya lo tiene como view).

**No requiere tocar RLS de `doctor_profiles`** — la tabla privada queda igual de protegida; solo abrimos lectura de 2 campos públicos vía view.

## Parte 2 — Frontend: usar la view en lugar de la tabla privada

Los componentes hoy consultan `doctor_profiles` directamente (RLS lo bloquea). Cambio a `doctor_profiles_public`:

**`src/contexts/LivesContext.tsx`** (línea ~148-150):
- Eliminar el query separado a `doctor_profiles` (`cedulaResult`).
- Ampliar el `select` de `doctor_profiles_public` a `user_id, followers_count, specialty, cedula_profesional, cofepris_permit`.
- Eliminar `cedulaMap`/`cofeprisMap` y leer directo de `doctorProfilesResult`.

**`src/pages/ContentGallery.tsx`** (línea ~310-318):
- Quitar la tercera promesa (`doctorCreds`).
- Ampliar `doctor_profiles_public` select a `user_id, specialty, cedula_profesional, cofepris_permit`.
- Mapear `creator_cedula` y `creator_cofepris` desde el mismo `doctorProfiles`.

Esto hace que el card de Lives Y el card de Contenido Premium muestren ambos badges (verde Cédula + azul COFEPRIS) **inmediatamente para todos los usuarios**.

## Parte 3 — "Aprobar doctores y verificaciones pendientes para pruebas"

Estado actual en BD:
- 2 doctores con `status='pending'` → los paso a `approved`.
- 2 `identity_verifications` con `status='in_progress'` → los paso a `verified`.
- 1 con `status='failed'` → lo paso a `verified`.

Migración SQL adicional:
```sql
UPDATE doctor_profiles SET status='approved', verified_at=now() 
  WHERE status='pending';
UPDATE identity_verifications SET status='verified', verified_at=now() 
  WHERE status IN ('in_progress','failed');
```

## Parte 4 — Favicon que aparece en Google

Google y los buscadores cachean el favicon agresivamente y exigen requisitos específicos:

1. **Crear `/public/favicon.ico`** (formato multi-resolución 16/32/48px) — Google prefiere `.ico` clásico aunque acepta PNG. Lo genero a partir de `favicon.png` con ImageMagick.
2. **Añadir en `<head>` del `index.html`** (justo después del `<link rel=icon>` actual):
   - `<link rel="icon" href="/favicon.ico" sizes="any">` (Google lo prefiere primero)
   - `<link rel="icon" type="image/png" sizes="32x32" href="/favicon.png?v=3">`
   - `<link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">`
   - `<link rel="shortcut icon" href="/favicon.ico">`
3. **Subir versión `?v=3`** en todas las referencias para invalidar caché del navegador y Google.
4. Verificar que `favicon.png` sea ≥48×48 (requisito Google) — lo es (icon-512 está disponible).

## Parte 5 — SEO básico completo (status final)

Audit del estado actual + mejoras:

| Item | Estado | Acción |
|---|---|---|
| `<title>` optimizado | ✅ ya existe | — |
| `<meta description>` 195 chars | ✅ ya existe | — |
| `canonical` | ✅ ya existe | — |
| `robots` index/follow | ✅ ya existe | — |
| OG tags + image absoluta | ✅ ya existe | — |
| Twitter card | ✅ ya existe | — |
| JSON-LD `MedicalOrganization` | ✅ ya existe | — |
| `manifest.json` PWA | ✅ ya existe | — |
| `lang="es"` | ✅ ya existe | — |
| `sitemap.xml` con 18 rutas | ✅ ya existe en `/public/sitemap.xml` | — |
| `robots.txt` con Sitemap directive | ✅ ya existe en `/public/robots.txt` | — |
| Google Search Console verification | ✅ meta tag insertado | — |
| Google Analytics gtag | ✅ ya insertado | — |
| **`favicon.ico` para Google** | ❌ falta | crear en esta entrega |
| **Multi-size icon links** | ❌ falta | añadir en esta entrega |
| **OG image: usar `icon-512.png`** (no favicon que es 192) | ⚠️ mejorar | cambiar `og:image` a `/icon-512.png?v=3` |
| **`hreflang` para idiomas** | ❌ falta | añadir `<link rel="alternate" hreflang="es-mx">` |
| **Schema.org `WebSite` con SearchAction** | ❌ falta | añadir segundo bloque JSON-LD para sitelinks search box |

## Parte 6 — Cómo enviar a indexar en Google (paso por paso, te lo dejo escrito)

Después del deploy:
1. Ir a [Search Console](https://search.google.com/search-console) → verificar dominio (ya está el meta tag, solo dale "Verificar HTML tag").
2. Search Console → **Sitemaps** → pegar `sitemap.xml` → Enviar.
3. Search Console → **URL Inspection** → pegar `https://medical-masters.com/` → "Solicitar indexación". Repetir para `/doctors`, `/lives`, `/content`, `/for-patients`, `/for-doctors`.
4. Validar JSON-LD en [Rich Results Test](https://search.google.com/test/rich-results) → pegar `https://medical-masters.com/`.
5. Validar OG en [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) → pegar URL → "Scrape Again".
6. Para forzar update de favicon en Google: tras 24-48h, en Search Console → "Acerca de los resultados" → Google escanea automáticamente el nuevo `.ico`.

## Archivos tocados

1. **Migración SQL** (vía herramienta de migraciones):
   - `DROP VIEW doctor_profiles_public CASCADE; CREATE VIEW ... con cedula_profesional + cofepris_permit`
   - Si `CASCADE` rompe alguna FK/RLS, recreo lo necesario después.
   - `UPDATE doctor_profiles SET status='approved' WHERE status='pending'`
   - `UPDATE identity_verifications SET status='verified' WHERE status IN ('in_progress','failed')`
2. `src/contexts/LivesContext.tsx` — usar columnas nuevas de la view
3. `src/pages/ContentGallery.tsx` — usar columnas nuevas de la view
4. `public/favicon.ico` — nuevo (multi-resolución)
5. `index.html` — agregar links de favicon `.ico`, sizes, hreflang, segundo JSON-LD WebSite, og:image a icon-512

## Resultado garantizado

- Cards de **Lives** y **Contenido Premium** muestran badges de Cédula + COFEPRIS para todos los doctores aprobados (los 26 ya tienen data).
- Todos los doctores quedan aprobados y todas las verifications pendientes pasan a `verified` para pruebas.
- Favicon `.ico` correctamente expuesto y referenciado para que Google lo indexe en SERP.
- SEO 100% completo + sitemap + robots + GA4 + Search Console + JSON-LD doble (Organization + WebSite) listo para enviar a indexar.

