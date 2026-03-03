

# Plan: Email de confirmación con onboarding para doctores

## Problema
Actualmente el correo de confirmación de registro es genérico para todos los roles. El usuario quiere que cuando un doctor se registre, el correo de confirmación incluya información de onboarding (qué esperar, pasos siguientes, proceso de verificación).

## Enfoque

El auth-email-hook recibe datos del usuario al registrarse. Podemos consultar la tabla `user_roles` desde el edge function (usando service role) para detectar si es doctor, y renderizar contenido adicional de onboarding en el template.

## Cambios

### 1. `supabase/functions/_shared/email-templates/signup.tsx`
Agregar una prop opcional `userRole` al template. Cuando sea `doctor`, mostrar sección adicional con:
- Mensaje de que su solicitud está siendo revisada
- Pasos del proceso: verificación de cédula, aprobación del equipo (24-48h)
- Qué podrán hacer una vez aprobados (transmisiones en vivo, consultas, contenido, prescripciones)
- Recordatorio de que igual deben verificar su correo primero

### 2. `supabase/functions/auth-email-hook/index.ts`
- Cuando el `emailType` sea `signup`, consultar `user_roles` usando el Supabase client con service role key para obtener el rol del usuario recién registrado
- Pasar el `userRole` como prop al template de signup
- Actualizar `SAMPLE_DATA` para incluir la prop en preview

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/_shared/email-templates/signup.tsx` | Agregar sección condicional de onboarding para doctores |
| `supabase/functions/auth-email-hook/index.ts` | Consultar rol del usuario y pasarlo al template |

