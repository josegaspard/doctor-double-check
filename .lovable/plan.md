

# Plan: OTP SMS completo, verificación de teléfono en onboarding, banner persistente y renombrar nav

Este plan cubre 4 cambios principales:

## 1. Agregar columna `phone` a la tabla `profiles`

La tabla `profiles` no tiene columna de teléfono. Se necesita una migración SQL:
- `ALTER TABLE profiles ADD COLUMN phone text;`

## 2. Verificación de teléfono por SMS en onboarding (todos los roles)

**Nuevo edge function `verify-phone-otp`:**
- Recibe `{ phone, action }` donde action es `send` o `verify`
- Al enviar: genera un OTP de 6 dígitos, lo guarda en una nueva tabla `phone_verifications` (phone, otp_code, user_id, expires_at, verified_at), y envía SMS via Vonage usando la API key `y60kyP4GXNuSVBHI` (se guardará como secret `SMS_API_KEY`)
- También necesitamos `SMS_API_SECRET` de Vonage
- Al verificar: compara el código y marca `verified_at`

**Nueva tabla `phone_verifications`:**
- `id uuid PK`, `user_id uuid`, `phone text`, `otp_code text`, `expires_at timestamptz`, `verified_at timestamptz`, `created_at timestamptz`

**Cambios en Onboarding (Step 1):**
- Agregar campo de teléfono con código de país (ej: +52) para todos los roles
- Botón "Enviar código" que llama al edge function
- Input de 6 dígitos para verificar
- Badge de "Verificado" cuando se completa
- Al completar onboarding, guardar `phone` en `profiles`

## 3. Guardar secrets de Vonage

- Se necesita `SMS_API_KEY` con valor `y60kyP4GXNuSVBHI`
- Se necesita `SMS_API_SECRET` (el usuario debe proporcionarlo — Vonage requiere api_key + api_secret)

**Nota importante:** Vonage requiere tanto `api_key` como `api_secret`. El valor proporcionado `y60kyP4GXNuSVBHI` es la API key. Necesitaré pedirte el API Secret de Vonage también.

## 4. Banner OTP persistente entre páginas

**Problema actual:** El estado del OTP (timer, paciente, código) vive dentro de `DoctorVault.tsx` y se pierde al navegar.

**Solución:** Crear un `OtpContext` (React Context) a nivel de `App.tsx`:
- Mover todo el estado del OTP (otpRequestedAt, otpPatient, otpCode, secondsLeft, verifiedPatients, deliveryMethod, etc.) al contexto
- Mover las funciones `handleRequestOtp`, `handleVerifyOtp` al contexto
- Renderizar `OtpFloatingBanner` y `OtpVerificationDialog` dentro del contexto provider (a nivel global)
- `DoctorVault.tsx` simplemente consume el contexto en lugar de manejar estado propio
- El banner aparece en cualquier página mientras el timer esté activo

**Archivos nuevos:**
- `src/contexts/OtpContext.tsx`

**Archivos modificados:**
- `src/App.tsx` — envolver con OtpProvider
- `src/pages/DoctorVault.tsx` — simplificar, usar contexto
- `src/components/vault/OtpFloatingBanner.tsx` — sin cambios
- `src/components/vault/OtpVerificationDialog.tsx` — sin cambios

## 5. Renombrar "Exp. Médico" → "Contenido Med."

**Archivos a modificar:**
- `src/lib/i18n/es.ts`: `contentShort: 'Contenido Med.'`, `content: 'Contenido Médico'`
- `src/lib/i18n/en.ts`: `contentShort: 'Med. Content'` (mantener `content: 'Medical Content'`)

## 6. Nuevo edge function para verificación de teléfono en onboarding

`supabase/functions/verify-phone-otp/index.ts`:
- Usa Vonage para enviar SMS con código OTP
- Valida y verifica código
- Actualiza tabla `phone_verifications`

## Resumen de entregables

| Cambio | Tipo |
|--------|------|
| Tabla `phone_verifications` + columna `phone` en profiles | Migración DB |
| Edge function `verify-phone-otp` | Backend |
| Contexto OTP global (`OtpContext`) | Frontend |
| Campo teléfono + verificación SMS en Onboarding | Frontend |
| Banner OTP persistente entre páginas | Frontend |
| Renombrar nav "Exp. Médico" → "Contenido Med." | i18n |
| Secret `SMS_API_KEY` | Config |

## Prerequisito antes de implementar

Necesito tu **API Secret de Vonage** (es diferente al API Key). En tu dashboard de Vonage (dashboard.nexmo.com), encontrarás tanto el `API key` como el `API secret`. El API key que me diste es `y60kyP4GXNuSVBHI` — ¿cuál es el API secret?

