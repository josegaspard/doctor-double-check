
# Plan: Auditoría y correcciones del flujo de registro, emails y onboarding

## Problemas identificados

### 1. URLs incorrectas en auth-email-hook
- `SAMPLE_PROJECT_URL` apunta a `https://doc-seek-relay.lovable.app` en lugar de `https://cirugiaesteticauribe.com`
- Los enlaces de confirmación del signup email template usan `siteUrl` que viene de `ROOT_DOMAIN` (correcto), pero el sample data usa la URL antigua

### 2. Branding antiguo "Dr Double Check" en 4 funciones
- `send-welcome-email/index.ts` — subjects dicen "Dr Double Check" en lugar de "Medical Masters"
- `unsubscribe-email/index.ts` — todo el HTML dice "Dr Double Check" (5+ ocurrencias)
- `create-recording-checkout/index.ts` — description del producto dice "Dr Double Check"
- `create-wallet-checkout/index.ts` — description dice "Dr Double Check"

### 3. No se envía email de aprobación al doctor/residente
- En `AdminDoctors.tsx` y `AdminResidents.tsx`, cuando el admin aprueba, solo se actualiza el status en DB y se muestra un toast. No se envía email ni notificación push al usuario informándole que ya puede usar la plataforma.

### 4. Welcome email para pacientes dice cosas genéricas
- El welcome email del paciente no menciona que necesita configurar su método de pago/recargar saldo para acceder a contenido premium.

### 5. Onboarding de paciente: no indica configurar método de pago
- En la pantalla de bienvenida post-onboarding para pacientes, no se menciona que deben recargar saldo para comprar contenido, suscribirse, o pagar consultas.

## Cambios propuestos

### A. Corregir URLs y branding (4 archivos)
| Archivo | Cambio |
|---------|--------|
| `auth-email-hook/index.ts` | Cambiar `SAMPLE_PROJECT_URL` a `https://cirugiaesteticauribe.com` |
| `send-welcome-email/index.ts` | Reemplazar "Dr Double Check" → "Medical Masters" en todos los subjects |
| `unsubscribe-email/index.ts` | Reemplazar todas las ocurrencias de "Dr Double Check" → "Medical Masters" |
| `create-recording-checkout/index.ts` | Reemplazar "Dr Double Check" → "Medical Masters" |
| `create-wallet-checkout/index.ts` | Reemplazar "Dr Double Check" → "Medical Masters" |

### B. Email de aprobación para doctor/residente
Crear función edge `send-approval-email` que envíe un correo profesional cuando el admin aprueba la cuenta, informando:
- Cuenta aprobada, ya puede usar todas las funciones
- Lista de lo que puede hacer ahora (según rol)
- Botón CTA a `https://cirugiaesteticauribe.com/login`

Modificar `AdminDoctors.tsx` y `AdminResidents.tsx` para invocar esta función tras aprobar.

### C. Mejorar welcome email para pacientes
Actualizar `send-welcome-email/index.ts`:
- Agregar mensaje sobre recargar saldo para acceder a contenido premium
- Mencionar la wallet y cómo funciona
- Botón CTA a la plataforma

### D. Mejorar pantalla de bienvenida post-onboarding para pacientes
En `Onboarding.tsx`, en la pantalla de `showWelcome` para pacientes, agregar un tip/alert indicando que debe recargar saldo en su wallet para acceder a contenido premium, suscripciones y consultas.

### E. Notificación in-app al aprobar doctor/residente
Insertar una notificación en la tabla `notifications` cuando el admin aprueba, para que el usuario la vea al entrar a la plataforma.

## Resumen de archivos a modificar
1. `supabase/functions/auth-email-hook/index.ts` — corregir SAMPLE_PROJECT_URL
2. `supabase/functions/send-welcome-email/index.ts` — corregir branding y agregar info de wallet para pacientes
3. `supabase/functions/unsubscribe-email/index.ts` — corregir branding
4. `supabase/functions/create-recording-checkout/index.ts` — corregir branding
5. `supabase/functions/create-wallet-checkout/index.ts` — corregir branding
6. `supabase/functions/send-approval-email/index.ts` — **NUEVO** — email de cuenta aprobada
7. `src/pages/AdminDoctors.tsx` — enviar email + notificación al aprobar
8. `src/pages/AdminResidents.tsx` — enviar email + notificación al aprobar
9. `src/pages/Onboarding.tsx` — agregar tip de wallet en pantalla de bienvenida para pacientes
