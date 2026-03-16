

# Plan: Integración completa de Veriff para verificación de identidad

## Resumen

Reemplazar el sistema actual de verificación manual (subir fotos de INE) con Veriff, que hace reconocimiento biométrico automático (foto de documento + selfie en vivo). Se integrará tanto en la página de verificación de identidad existente como opcionalmente durante el onboarding de doctores/residentes.

## Arquitectura

```text
Usuario (Onboarding / IdentityVerification)
  │
  ▼
Edge Function: create-veriff-session
  │  POST → https://stationapi.veriff.com/v1/sessions/
  │  Header: X-AUTH-CLIENT: API_KEY
  │  Returns: session URL + session ID
  ▼
Veriff InContext SDK (iframe dentro de la app)
  │  Usuario completa verificación biométrica
  │  Veriff procesa y decide
  ▼
Edge Function: veriff-webhook
  │  Recibe decisión (approved/declined/resubmission_requested)
  │  Verifica firma HMAC con shared secret
  │  Actualiza identity_verifications en BD
  │  Envía email de notificación
  ▼
BD: identity_verifications (provider='veriff', external_id=session_id)
```

## Cambios

### 1. Almacenar secrets
- `VERIFF_API_KEY`: `8849ffc8-4dbd-4bd9-b449-95b4f077560e`
- `VERIFF_SHARED_SECRET`: `33839923-207e-492c-b6fa-3f09e298cb1d`

### 2. Edge Function: `create-veriff-session`
- Recibe `user_id` del usuario autenticado
- Consulta `profiles` para obtener nombre y email
- POST a `https://stationapi.veriff.com/v1/sessions/` con `X-AUTH-CLIENT` header
- Body: `{ verification: { callback: publishedUrl, person: { firstName, lastName }, vendorData: user_id } }`
- Inserta registro en `identity_verifications` con `provider='veriff'`, `external_id=session.id`, `status='pending'`
- Retorna `session.url` al frontend

### 3. Edge Function: `veriff-webhook`
- Recibe POST de Veriff con decisión
- Valida firma HMAC-SHA256 usando shared secret
- Mapea `verification.status`: approved→approved, declined→rejected, resubmission_requested→rejected
- Actualiza `identity_verifications` por `external_id`
- Invoca `send-verification-email` con el status correspondiente

### 4. Frontend: `IdentityVerification.tsx`
- Reemplazar el formulario manual de subir fotos por flujo Veriff
- Instalar `@veriff/js-sdk` y `@veriff/incontext-sdk` via CDN (script tag) o npm
- Botón "Iniciar verificación" → llama a `create-veriff-session` → abre Veriff InContext iframe
- Mostrar estado actual (pending/approved/rejected) igual que ahora
- Mantener fallback: si Veriff falla, mostrar opción de verificación manual

### 5. Frontend: `Onboarding.tsx` (doctores/residentes)
- En step 2, después de la cédula profesional, agregar sección de verificación de identidad con Veriff
- Mostrar botón "Verificar mi identidad con Veriff" que abre el flujo InContext
- Estado se guarda en `identity_verifications`; no bloquea el onboarding pero se muestra como recomendado
- Badge de "Identidad verificada" si ya completó el proceso

### 6. `AdminVerifications.tsx`
- Agregar columna "Proveedor" (manual vs veriff) para distinguir verificaciones
- Las verificaciones Veriff ya vienen con decisión automática; el admin solo revisa las manuales

## Archivos a crear/modificar

| Archivo | Acción |
|---------|--------|
| `supabase/functions/create-veriff-session/index.ts` | Crear — crea sesión Veriff + registro en BD |
| `supabase/functions/veriff-webhook/index.ts` | Crear — recibe decisión, actualiza BD |
| `src/pages/IdentityVerification.tsx` | Modificar — reemplazar upload manual con flujo Veriff |
| `src/pages/Onboarding.tsx` | Modificar — agregar verificación Veriff opcional en step 2 |
| `src/pages/AdminVerifications.tsx` | Modificar menor — mostrar proveedor |
| Secrets | Agregar VERIFF_API_KEY y VERIFF_SHARED_SECRET |

