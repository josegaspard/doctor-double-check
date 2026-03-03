

# Plan: Opciones de entrega OTP y mejoras al flujo

## Situación actual

El OTP ya funciona con **2 canales**:
1. **Notificación in-app** (siempre se envía)
2. **Email via Resend** (siempre se envía si hay email)

No hay SMS implementado actualmente. No se necesita Twilio.

## Alternativas SMS (con links directos)

| Proveedor | Ventaja | Precio | Link |
|-----------|---------|--------|------|
| **Vonage (Nexmo)** | Registro rápido, sin verificación extensa, API simple | ~$0.008/SMS MX | [vonage.com/communications-apis/sms](https://www.vonage.com/communications-apis/sms/) |
| **Telnyx** | Developer-friendly, aprobación rápida, cobertura MX | ~$0.006/SMS MX | [telnyx.com/products/sms-api](https://telnyx.com/products/sms-api) |
| **Brevo (ex-Sendinblue)** | Todo-en-uno (email+SMS), sin verificación compleja | ~$0.01/SMS MX | [brevo.com/features/sms-marketing](https://www.brevo.com/features/sms-marketing/) |

**Recomendación**: Vonage o Telnyx por su facilidad de registro y cobertura en México.

## Cambios propuestos

### 1. Agregar selector de método de entrega en el dialog OTP
En `OtpVerificationDialog.tsx`, agregar un toggle/radio para que el doctor elija:
- **📧 Email + Notificación** (por defecto, siempre disponible)
- **📱 SMS + Notificación** (solo si se configura un proveedor SMS)

### 2. Actualizar edge function `send-otp-email`
- Recibir parámetro `deliveryMethod: 'email' | 'sms' | 'both'`
- Si es `email`: enviar email (como ahora) + notificación in-app
- Si es `sms`: enviar SMS via el proveedor configurado + notificación in-app
- Si es `both`: enviar ambos
- Renombrar internamente a `send-otp` (pero mantener el nombre de la función para no romper nada)

### 3. Agregar soporte SMS genérico en la edge function
- Verificar si existe el secret `SMS_API_KEY` y `SMS_PROVIDER` (vonage/telnyx/brevo)
- Si no existe, el botón SMS se muestra deshabilitado con tooltip "Configura un proveedor SMS"
- Implementar envío para Vonage como default (API más simple)

### 4. Actualizar textos del dialog
- Cambiar "El paciente recibirá el código por notificación y correo electrónico" → texto dinámico según método elegido
- Agregar banner informativo en la info card del vault

### 5. Push notification (ya funciona)
Ya tienes VAPID keys configuradas. La notificación in-app ya se envía siempre. Si el paciente tiene push habilitado, lo recibirá automáticamente.

## Archivos a modificar
1. `src/components/vault/OtpVerificationDialog.tsx` — agregar selector de método
2. `supabase/functions/send-otp-email/index.ts` — agregar soporte SMS condicional
3. `src/pages/DoctorVault.tsx` — pasar método de entrega seleccionado
4. `src/components/vault/OtpFloatingBanner.tsx` — mostrar método usado

## Flujo final para el doctor
1. Abre expediente → Dialog OTP aparece
2. Elige método: **Email** (default) o **SMS** (si configurado)
3. Click "Solicitar código" → se envía por el canal elegido + notificación in-app
4. Paciente recibe código → se lo dice al doctor → doctor ingresa → acceso concedido

