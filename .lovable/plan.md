
# Ya implementado: Correo automático de aprobación

El flujo que describes **ya existe y funciona correctamente** en la plataforma. No se necesitan cambios.

## Flujo actual

1. **Admin aprueba doctor** en `AdminDoctors.tsx` → actualiza `doctor_profiles.status` a `'approved'`
2. **Se invoca `send-approval-email`** con el email, nombre y rol `'doctor'`
3. **El correo incluye**:
   - Header verde con "Cuenta Aprobada"
   - Saludo personalizado con el nombre del doctor
   - Lista de funciones desbloqueadas (lives, consultas, recetas, contenido, pagos, analíticas)
   - Botón CTA "Ir a mi panel de doctor" → `https://cirugiaesteticauribe.com/doctor`
4. **Notificación in-app** simultánea con título "Tu cuenta ha sido aprobada"

Lo mismo aplica para **residentes** en `AdminResidents.tsx` con su contenido específico (50% descuento, sesiones clínicas, etc.).

## No se requieren cambios

Todo el sistema está conectado: edge function desplegada, invocación desde el admin, notificación in-app, y contenido diferenciado por rol.
