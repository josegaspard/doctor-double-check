

# Plan: Google Analytics + Google Search Console (DNS TXT)

Hay dos partes: una la puedo hacer yo en código, la otra requiere acción manual tuya en el panel de Lovable porque toca DNS del dominio (yo no tengo acceso al registrador).

## Parte 1 — Google Analytics (lo hago yo, 100% automático)

Insertar el snippet `gtag.js` con tu Measurement ID `G-NB9CJEJYPV` en `index.html` dentro del `<head>`, justo antes del cierre, después del JSON-LD.

**Archivo:** `index.html`

```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-NB9CJEJYPV"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-NB9CJEJYPV', {
    anonymize_ip: true,
    cookie_flags: 'SameSite=None;Secure'
  });
</script>
```

Notas:
- `anonymize_ip: true` para cumplimiento GDPR/LFPDPPP México.
- Se carga `async` para no bloquear el render.
- El tracking funciona automáticamente en todas las rutas SPA porque `gtag` registra `page_view` por defecto en cada cambio de URL gestionado por React Router.

Tras publicar, los eventos empezarán a registrarse en GA4 en 24-48h (la propiedad `G-NB9CJEJYPV` los recibirá en tiempo real en el reporte "Realtime" de GA inmediatamente).

## Parte 2 — Search Console (DNS TXT) — requiere TU acción

**No puedo hacerlo yo** porque la verificación TXT se aplica en los registros DNS del dominio, no en el código del sitio. Lovable expone un panel para gestionar DNS solo si compraste el dominio a través de Lovable. Pasos exactos:

### Si compraste `medical-masters.com` a través de Lovable:

1. Abre **Project Settings → Domains**.
2. Localiza `medical-masters.com`, abre el menú **⋯ (tres puntos)** → **Configure**.
3. En el diálogo **Manage domain**, clic en **Manage DNS records**.
4. Clic en **Add record** y agrega:
   - **Type:** `TXT`
   - **Name / Host:** `@` (o déjalo vacío — significa el dominio raíz)
   - **Value / Content:** `google-site-verification=q7uAZfODJ-rGMvSBTeaZ1CNHsxp1HqtHj3k-yODwlMs`
   - **TTL:** `3600` (o el valor por defecto)
5. Guarda.
6. Espera 5-30 min (puede tardar hasta 24h) y vuelve a Search Console → clic **Verificar**.

### Si compraste el dominio en otro registrador (GoDaddy, Namecheap, Cloudflare, etc.):

1. Inicia sesión en tu registrador.
2. Ve a la sección **DNS / Zone Editor / Manage DNS**.
3. Agrega un nuevo registro:
   - **Tipo:** TXT
   - **Host / Nombre:** `@`
   - **Valor:** `google-site-verification=q7uAZfODJ-rGMvSBTeaZ1CNHsxp1HqtHj3k-yODwlMs`
   - **TTL:** 3600
4. Guarda y vuelve a Search Console → **Verificar**.

**Importante:** NO elimines este registro TXT después de verificar. Google lo revalida periódicamente; si lo borras, perderás la propiedad y dejarás de recibir datos.

## Parte 3 — Después de verificar Search Console

Una vez verificado el dominio, te recomiendo cargar el sitemap (que ya creé) directamente en Search Console:

1. En GSC, menú lateral → **Sitemaps**.
2. En "Añadir un sitemap nuevo" pega: `sitemap.xml`
3. Clic **Enviar**.

Esto acelera la indexación de las 18 rutas públicas que ya tienes definidas en `public/sitemap.xml`.

## Resumen

| Tarea | Quién | Estado |
|---|---|---|
| Insertar Google Analytics `gtag.js` en `<head>` | Yo (al aprobar) | Pendiente |
| Crear registro TXT de verificación en DNS | Tú (panel Lovable o registrador) | Pendiente — manual obligatoria |
| Enviar sitemap.xml en GSC | Tú (después de verificar) | Pendiente |

## Archivos tocados

1. `index.html` — añade snippet de Google Analytics

