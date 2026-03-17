

# Plan: Editar y verificar teléfono y correo en el perfil de usuario

## Problema actual
- El perfil muestra email y teléfono como datos estáticos sin opción de editar
- Cuentas existentes que no verificaron teléfono en onboarding no tienen forma de hacerlo después
- No hay forma de cambiar el correo electrónico

## Cambios en `src/pages/UserProfile.tsx`

### Sección de teléfono (líneas 551-563)
Reemplazar la visualización estática del teléfono con un bloque editable:
- **Si tiene teléfono verificado**: Mostrar número enmascarado + badge "Verificado" + botón "Cambiar"
- **Si no tiene teléfono**: Mostrar "Sin verificar" + botón "Agregar teléfono"
- **Al editar**: Expandir inline con selector de código de país (+52, +1, +57...) + input + botón "Enviar código SMS"
- **Tras enviar**: Mostrar input de 6 dígitos + botón "Verificar" + timer de 5 min
- **Al verificar**: Actualizar `profiles.phone` vía el edge function `verify-phone-otp` (ya existe con rate limit 1/día)

### Sección de email (líneas 547-549 y 914-922)
Agregar opción de editar email en ambos lugares donde se muestra:
- **Display**: Email actual + badge "Verificado" (ya que están logueados con ese email) + botón "Cambiar"
- **Al editar**: Input de nuevo email + botón "Enviar verificación"
- Llamar `supabase.auth.updateUser({ email: newEmail })` que envía un email de confirmación al nuevo correo
- Mostrar toast explicativo: "Se envió un enlace de verificación a tu nuevo correo. Tu email cambiará cuando confirmes el enlace."
- No se cambia inmediatamente — Supabase requiere confirmación del nuevo email

### Estados nuevos en el componente
```
isEditingPhone, editedPhone, phoneCountryCode, phoneOtpSent, phoneOtpCode, isVerifyingPhone, phoneSendingOtp
isEditingEmail, editedEmail, isSavingEmail
```

### UX móvil
- Todos los inputs inline expandibles con animación (AnimatePresence como ya se usa para nombre/bio)
- Botones de acción con min-height 44px para touch
- Inputs full-width en móvil
- Selector de código de país compacto (dropdown)

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/UserProfile.tsx` | Agregar edición inline de teléfono con verificación SMS + edición de email con verificación |

No se necesitan cambios en edge functions ni DB — `verify-phone-otp` ya maneja todo el flujo SMS y `supabase.auth.updateUser` maneja el cambio de email nativamente.

