

# Plan: Credenciales en Contenido Premium + Optimización de Menú + SEO Audit

## Parte 1 — Credenciales del doctor en Contenido Premium

Replicar el mismo patrón que ya existe en `LivesGrid` (cédula profesional + COFEPRIS) dentro de las tarjetas y el modal de Contenido Premium.

**Archivos a modificar:**
- `src/pages/ContentGallery.tsx`: en `fetchContents`, ampliar el query a `doctor_profiles_public` para traer también `cedula_professional` y `cofepris_permit` (o los campos equivalentes del schema). Mapearlos al `DoctorContent` como `creator_cedula` y `creator_cofepris`.
- `src/pages/ContentGallery.tsx > ContentCardBody`: bajo el nombre del doctor, agregar dos `Badge` outline con `ShieldCheck`:
  - Verde (success): `Cédula: {creator_cedula}`
  - Azul (info): `COFEPRIS: {creator_cofepris}`
  - Solo se renderizan si existen; truncado responsive para que nunca rompan layout.
- `src/components/content/ContentPreviewModal.tsx`: ampliar `content` props con `creator_cedula?` y `creator_cofepris?`. Mostrarlos junto al avatar del creador, con el mismo estilo que en `LivePlayer`.
- Migración: si los campos no existen en `doctor_profiles_public`, exponerlos vía `ALTER VIEW` o desde la tabla `doctor_profiles` (verificar primero antes de migrar — si ya están solo se mapean).

## Parte 2 — Menú optimizado (Desktop / Tablet / Mobile)

El problema: el menú desktop tiene ~14 items para doctor y se cortan. Solución multi-breakpoint:

**`src/components/layout/MainLayout.tsx`:**

- **Desktop (≥1024px)**: en lugar de hacer scroll horizontal, dividir en dos zonas:
  - Items principales (máx 6) visibles directamente: Lives, Education, Soy Médico, Chat, Panel, Disponibilidad.
  - El resto se agrupa bajo un dropdown `MoreHorizontal` "Más" (Contenido, Reuniones, Mis Pacientes, Localizar Hospital, Material Médico, Noticias). Esto elimina el scroll y todo es accesible.
- **Tablet (768–1023px)**: mantener el `Sheet` lateral con hamburguesa (ya existe) — verificar que muestre TODOS los items con scroll vertical limpio.
- **Mobile (<768px)**: bottom-nav fija de 5 tabs (4 + "Más"). El 5° botón "Más" abre un `Sheet` bottom con grid de íconos 3×N para acceder al resto.
  - Reducir tamaño de tabs a `text-[10px]` con ícono `w-5 h-5` para que entren cómodamente.
  - Asegurar `safe-area-inset-bottom` en iOS.

**Reducción tipográfica:**
- Desktop nav: `text-[11px] xl:text-xs` con `px-2`, `gap-1`, ícono `w-3.5 h-3.5`.
- Eliminar `overflow-x-auto` del desktop nav (ya no lo necesita con el dropdown).

## Parte 3 — QA Checklist URL

Ya está creada la ruta. URL directa:

```
https://medical-masters.com/admin/qa-checklist
```

(Requiere sesión con rol `admin`.) Adicionalmente añadir un atajo en `AdminDashboard` (card "QA Checklist E2E") para que sea descubrible.

## Parte 4 — Auditoría SEO (sin cambios de código, solo verificación)

Estado actual de `index.html`:

| Elemento | Estado | Valor |
|---|---|---|
| `<title>` | ✅ Optimizado | "Medical Masters · Orientación médica con especialistas verificados" (66 chars) |
| `<meta description>` | ✅ Optimizado | 195 chars con keywords México/SEP/COFEPRIS |
| `<meta keywords>` | ✅ Presente | 8 keywords relevantes |
| `<meta theme-color>` | ✅ `#163a83` (azul marca) |
| Open Graph (og:title/description/image/locale) | ✅ Completo (`es_MX`) |
| Twitter Card | ✅ summary con título/descripción/imagen |
| `<link rel="icon">` | ✅ `/favicon.png?v=2` |
| `apple-touch-icon` | ✅ Configurado |
| `manifest.json` | ✅ Linkeado (PWA) |
| `lang="es"` | ✅ Correcto |

**Mejoras SEO adicionales que aplicaré:**
1. Añadir `<link rel="canonical" href="https://medical-masters.com/" />` para evitar duplicados con dominio preview.
2. Añadir `<meta name="robots" content="index, follow, max-image-preview:large" />`.
3. Añadir JSON-LD `Organization` schema (nombre, logo, sameAs redes sociales) para rich snippets en Google.
4. Cambiar `og:image` y `twitter:image` a una URL absoluta (`https://medical-masters.com/icon-512.png`) para que LinkedIn/WhatsApp la cacheen correctamente.
5. Verificar que `/public/robots.txt` permite indexación.

## Parte 5 — Mega-prompt consolidado (auditoría de cumplimiento)

Tras esta entrega, el estado del megaprompt completo del cliente queda:

| Petición del cliente | Estado |
|---|---|
| Cédula + COFEPRIS en lives | ✅ |
| Cédula + COFEPRIS en Contenido Premium | ⚠️ → ESTE PLAN |
| Logo MM en favicon/header | ✅ |
| Precios de orientación solo a pacientes | ✅ |
| Hábitos: alcohol/tabaco/ejercicio con frecuencia condicional | ✅ |
| Contenido Premium: Todo / Gratis / Comprados | ✅ |
| Chat sin archivos | ✅ |
| Localizar hospital con Maps + Waze | ✅ |
| Doctores activos después de "Ubicación activa" | ✅ |
| Vault → "Mis Pacientes" + contacto cobros + amarillo→azul | ✅ |
| Medical Master Education (casos clínicos + chat residentes/doctores) | ✅ |
| "Soy Médico" después de Education | ✅ |
| Compartir contenido a ambos (sin elección de chat) | ✅ |
| Menú accesible en todos los dispositivos | ⚠️ → ESTE PLAN |
| QA Checklist E2E | ✅ (URL: `/admin/qa-checklist`) |
| Wallet con notificaciones initiated/paid/failed | ✅ |
| AccessGuard auditable ("¿Por qué no puedo entrar?") | ✅ |
| Resumen clínico descargable con DRM UX | ✅ |

## Resumen de archivos tocados

1. `src/pages/ContentGallery.tsx` — credenciales del doctor en cards
2. `src/components/content/ContentPreviewModal.tsx` — credenciales en modal
3. `src/components/layout/MainLayout.tsx` — reorganización nav desktop + mobile compactos
4. `index.html` — canonical, robots meta, JSON-LD Organization, og:image absoluta
5. `src/pages/AdminDashboard.tsx` — atajo a QA Checklist
6. (Posible) migración SQL si los campos `cedula_professional`/`cofepris_permit` no están en `doctor_profiles_public`

