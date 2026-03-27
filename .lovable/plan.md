

# Auditoría Completa — Gaps Encontrados

## Estado actual: ~95% completo

La gran mayoría de la lógica está implementada correctamente. Estos son los gaps restantes:

---

## Gap 1: Residentes NO pueden iniciar chat con doctores aceptados

**Problema:** En `DoctorProfile.tsx` línea 237, `handleStartConsultation` bloquea con `if (role !== 'patient')` y muestra error. Un residente con conexión aceptada no tiene forma de abrir un chat con el doctor.

**Fix:** En `DoctorProfile.tsx`:
- Agregar lógica para verificar si el residente tiene conexión `accepted` con el doctor
- Si `role === 'resident'` y conexión aceptada, permitir `startChatSession()` directamente (sin cobro)
- Cambiar el CTA button para residentes conectados: mostrar "Iniciar Chat" en vez de "Consultar"
- Si la conexión es `pending`, mostrar badge "Solicitud pendiente" y deshabilitar el botón
- Si no hay conexión, mostrar "Solicitar conexión" (como en Doctors.tsx)

## Gap 2: Doctor-to-Doctor chat funciona pero sin `consultation` record

**Problema:** Cuando un doctor abre chat con otro doctor (línea 196: `canChatDirectly = role === 'doctor'`), `startChatSession()` crea la sesión correctamente. Sin embargo, en `Chat.tsx` línea 195, `fetchOrCreateConsultation` intenta crear una `consultation` y requiere tanto `doctorId` como `patientId`. En un chat doctor-doctor, NO hay `patientId`, así que `consultationId` queda null.

Esto significa: no habrá resumen post-consulta, no habrá video call, no habrá registro de la sesión como consulta. **Esto es correcto por diseño** — los chats entre doctores son de networking/colaboración, no consultas médicas. No requiere fix.

## Gap 3: `PostConsultationSummaryDialog` usa `as any` 

**Problema menor:** Línea 39 de `PostConsultationSummaryDialog.tsx` usa `as any` para el update. Los campos `doctor_summary`, `doctor_recommendations`, `completed_at` ya existen en la tabla (migración aplicada). Si los tipos autogenerados ya incluyen estos campos, se puede quitar el `as any`. Si no, el cast es necesario por ahora.

**Fix:** Verificar `types.ts` y quitar `as any` si los campos ya están tipados. Si no, dejar como está (funcional).

## Gap 4: `ConsultationSummaryCard` también usa `as any`

Línea 31: `(data as any).doctor_recommendations`. Mismo caso — funcional pero no type-safe.

---

## Plan de correcciones (solo Gap 1 — el único funcional)

### Archivo: `src/pages/DoctorProfile.tsx`
1. Agregar estado `residentConnectionStatus: string | null`
2. En `useEffect`, si `role === 'resident'`, consultar `doctor_resident_connections` para ver el status con este doctor
3. Modificar `handleStartConsultation`:
   - Si `role === 'resident'` y `residentConnectionStatus === 'accepted'` → llamar `startChatSession()` directamente
   - Si `role === 'resident'` y `residentConnectionStatus === 'pending'` → toast info "Solicitud pendiente"
   - Si `role === 'resident'` y sin conexión → llamar `handleRequestConnection()` para solicitar
4. Modificar el CTA button para mostrar texto adecuado según el estado de conexión del residente
5. Agregar función `handleRequestConnection` (insert en `doctor_resident_connections`)

### i18n
- Agregar claves: `doctorProfile.startChat`, `doctorProfile.connectionPending`, `doctorProfile.requestConnection`

**No se requieren migraciones de DB** — la tabla `doctor_resident_connections` y las RLS ya existen.

