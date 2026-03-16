

# Plan: Alternativa SMS para OTP (sin Twilio)

## Contexto
Los cambios de país en tarjetas y traducciones `nearMe` ya están implementados en los mensajes anteriores. Lo pendiente es habilitar SMS para OTP.

El sistema ya envía OTP por **email** (Resend funciona). Para SMS, el código soporta Vonage/Telnyx pero ninguno tiene credenciales configuradas. Twilio fue rechazado.

## Alternativas simples para SMS

| Proveedor | Costo | Verificación | Dificultad |
|-----------|-------|-------------|------------|
| **Textbelt** | $0.05/SMS, 1 gratis/día | Solo API key, sin verificar identidad | Muy fácil |
| **Brevo** (ex-Sendinblue) | Tier gratis con SMS incluidos | Registro simple | Fácil |
| **Vonage** (ya soportado en código) | Trial gratis con créditos | Registro con verificación básica | Medio |

### Recomendación: **Textbelt**
- No requiere verificar identidad ni comprar número
- API extremadamente simple: 1 endpoint POST
- Solo necesitas una API key de [textbelt.com](https://textbelt.com)
- Funciona internacionalmente

## Cambios técnicos

### 1. `supabase/functions/send-otp-email/index.ts`
Agregar función `sendSmsTextbelt()`:
```ts
async function sendSmsTextbelt(to: string, message: string): Promise<boolean> {
  const resp = await fetch("https://textbelt.com/text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone: to.replace(/\D/g, ''),
      message,
      key: SMS_API_KEY,
    }),
  });
  const data = await resp.json();
  return data.success === true;
}
```

Actualizar `sendSms()` para incluir `textbelt` como opción de `SMS_PROVIDER`.

### 2. Secreto necesario
- `SMS_API_KEY` — La API key de Textbelt (se obtiene en textbelt.com, plan de pago o `textbelt` para 1 SMS gratis/día de prueba)
- `SMS_PROVIDER` — Configurar como `textbelt`

### 3. Sin cambios en frontend
El `OtpVerificationDialog` ya soporta la opción SMS y detecta `smsAvailable` dinámicamente.

## Archivos a modificar
1. `supabase/functions/send-otp-email/index.ts` — Agregar provider Textbelt
2. Configurar secretos `SMS_API_KEY` y `SMS_PROVIDER`

