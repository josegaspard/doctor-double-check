

# Plan: Corregir disponibilidad de SMS en diálogo OTP

## Problema

`smsAvailable` empieza en `false` en el `OtpContext` y solo se actualiza después de la primera llamada a `send-otp-email`. Esto causa que el diálogo muestre "Requiere configurar proveedor SMS" antes de hacer cualquier petición, aunque el proveedor SMS ya está configurado y el paciente tiene teléfono verificado.

## Solución

### 1. OtpContext.tsx — Pre-check SMS al abrir el diálogo

Cuando se llama `openOtpForPatient`, hacer una consulta rápida a la tabla `profiles` para verificar si el **paciente** tiene un teléfono registrado (`phone` no nulo). Si lo tiene, setear `smsAvailable = true` inmediatamente.

```tsx
const openOtpForPatient = useCallback(async (patientId, patientName) => {
  // Check if patient has phone
  const { data } = await supabase
    .from('profiles')
    .select('phone')
    .eq('id', patientId)
    .single();
  setSmsAvailable(!!data?.phone);
  // ...rest
}, []);
```

### 2. OtpVerificationDialog.tsx — Cambiar texto cuando SMS no disponible

Cambiar el texto de "Requiere configurar proveedor SMS" a algo más preciso:
- Si `!smsAvailable`: **"El paciente no tiene teléfono verificado"**

Esto refleja la realidad: el proveedor SMS sí está configurado, pero el paciente no tiene teléfono.

## Archivos a modificar

1. **`src/contexts/OtpContext.tsx`** — Añadir consulta a `profiles.phone` en `openOtpForPatient`
2. **`src/components/vault/OtpVerificationDialog.tsx`** — Cambiar texto línea 107

