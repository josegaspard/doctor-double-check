

# Plan: Rate limits SMS, teléfono en onboarding, privacidad de datos, y confirmación SMS funcional

## 1. Rate limits en edge functions

### `verify-phone-otp` (onboarding phone verification)
- Antes de generar OTP, consultar `phone_verifications` para contar intentos del `user_id` en las últimas 24h
- Si ya hay 1+ registro con `verified_at IS NULL` creado hoy → rechazar con "Solo puedes verificar tu teléfono 1 vez al día"
- Si ya tiene un registro con `verified_at IS NOT NULL` para ese phone → retornar "Teléfono ya verificado"

### `send-otp-email` (vault OTP para doctores)
- Contar registros en `expediente_otp` donde `doctor_id` = caller y `deliveryMethod` fue 'sms' o 'both', creados hoy
- Si ya hay 2+ → rechazar SMS pero permitir email: "Límite de SMS alcanzado (2/día). Usa email."
- Email sin límite diario

## 2. Campo de teléfono con verificación SMS en Onboarding (Step 1)

**En `src/pages/Onboarding.tsx` Step 1**, después del selector de país y antes del selector de rol:

- Agregar estados: `phone`, `phoneCountryCode` (+52 default), `phoneVerified`, `isVerifyingPhone`, `phoneSendingOtp`, `phoneOtpCode`, `phoneOtpSent`
- UI: Input con selector de código de país (+52, +1, +57, etc.) + input de número
- Botón "Enviar código" que llama a `verify-phone-otp` con action=send
- Cuando se envía, mostrar input de 6 dígitos + botón "Verificar"
- Al verificar exitosamente: badge verde "✓ Verificado"
- Si no se registra o verifica → no bloquea onboarding, campo es opcional
- Texto explicativo: "Tu número se usa para confirmar códigos de seguridad (OTP) cuando los doctores necesiten acceder a tu expediente médico. También puedes usar correo electrónico."
- Al hacer submit del onboarding, guardar phone en profiles si está verificado
- Guardar progreso del phone en `onboarding_progress` (necesita migración para agregar columna `phone`)

**Migración DB**: `ALTER TABLE onboarding_progress ADD COLUMN phone text;`

## 3. Teléfono privado en perfil de usuario (`UserProfile.tsx`)

- Agregar fetch del campo `phone` del perfil del usuario
- Mostrar debajo del email (que ya se muestra) con icono Phone
- Si `phone` existe: mostrar número con máscara parcial + badge "Verificado" verde
- Si no existe o no verificado: mostrar "Sin verificar" + botón "Verificar ahora" que abre un mini-dialog inline para enviar OTP y verificar
- Estos datos (email y phone) solo son visibles por el propio usuario (ya está así por la naturaleza de la página de perfil)
- Agregar texto discreto: "Datos privados - solo tú puedes ver esta información"

## 4. Actualizar `send-otp-email` para rate limit de SMS

- En el edge function, antes de enviar SMS, contar `expediente_otp` records del doctor hoy con delivery via SMS
- Si >= 2, forzar `deliveryMethod = 'email'` y retornar `smsLimitReached: true`
- En el frontend (`OtpContext.tsx`), mostrar toast informativo cuando `smsLimitReached` es true

## 5. Actualizar `verify-phone-otp` para rate limit

- Contar `phone_verifications` del user_id creadas hoy (últimas 24h)
- Si >= 1 intento de envío → rechazar

## 6. Confirmar: ¿Funciona el SMS?

Sí, la integración con Vonage está configurada con `SMS_API_KEY` y `SMS_API_SECRET` guardados como secrets. El edge function `verify-phone-otp` ya tiene la lógica de envío vía Vonage REST API (`rest.nexmo.com/sms/json`). El `send-otp-email` también soporta SMS via Vonage/Telnyx/Textbelt. Los SMS funcionarán una vez que Vonage procese los mensajes con las credenciales proporcionadas.

## Resumen de archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/verify-phone-otp/index.ts` | Rate limit 1/día |
| `supabase/functions/send-otp-email/index.ts` | Rate limit SMS 2/día, email sin límite |
| `src/pages/Onboarding.tsx` | Campo teléfono + verificación SMS en Step 1 |
| `src/pages/UserProfile.tsx` | Mostrar teléfono privado + estado verificación |
| `src/contexts/OtpContext.tsx` | Manejar `smsLimitReached` feedback |
| Migración DB | `onboarding_progress.phone` column |

