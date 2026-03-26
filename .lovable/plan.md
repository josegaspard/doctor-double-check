

# Auditoría de Lógica Completa — Problemas Encontrados

## Problemas detectados

### 1. `ConsultationSummaryCard` creado pero NUNCA renderizado
El componente existe en `src/components/chat/ConsultationSummaryCard.tsx` pero no se usa en ningún lado. Debería mostrarse en:
- **`ChatMessagesPanel.tsx`**: cuando una sesión está cerrada y tiene `consultationId`, mostrar el resumen del doctor arriba del mensaje "Sesión cerrada"
- **`MedicalRecord.tsx`**: en el historial clínico del paciente, listar los resúmenes de todas sus consultas completadas

### 2. Meetings: Residentes NO filtran invitados por conexiones aceptadas
El plan decía que residentes solo pueden crear reuniones con doctores que los aceptaron. Actualmente `MeetingCreateDialog.tsx` busca en TODOS los `doctor_profiles` sin filtrar por `doctor_resident_connections.status = 'accepted'`. Un residente puede invitar a cualquier doctor, incluso sin conexión.

### 3. Chat: El filtro `chatFilter` para residentes fuerza solo "doctors" pero NO hay default correcto
Para residentes, el código muestra solo el botón "Doctores" (líneas 401-408 de Chat.tsx), pero el estado inicial es `chatFilter = 'all'` (línea 34). Esto significa que al entrar por primera vez, un residente ve TODAS las sesiones (incluyendo cualquier sesión con pacientes si existiera). Debería inicializar `chatFilter` a `'doctors'` para residentes.

### 4. Chat: `getSessionDisplayInfo` asume paciente = participant1, doctor = participant2
Líneas 267-272: La función siempre retorna `participant2` para pacientes y `participant1` para doctores/residentes. Pero las sesiones podrían tener el orden invertido (participant1 = doctor, participant2 = paciente). No compara por `user.id` para determinar quién es el "otro".

**Fix**: Usar `session.participant1Id === user?.id` para determinar cuál es el "otro" participante, igual que ya se hace en `filterByType` (línea 44).

### 5. PostConsultationSummaryDialog usa `as any` para los campos
La query `.update({...} as any)` funciona pero no es type-safe. Los campos `doctor_summary`, `doctor_recommendations`, `completed_at` ya están en la tabla de la migración y deberían estar en los tipos generados. Si los tipos ya se regeneraron, el `as any` se puede quitar.

### 6. Meetings: Residentes no restringen creación de reuniones
Actualmente un residente puede crear reuniones y invitar a cualquiera. El plan requería que solo pudieran invitar doctores con conexión aceptada.

---

## Plan de correcciones

### Archivo 1: `src/components/chat/ChatMessagesPanel.tsx`
- Importar `ConsultationSummaryCard`
- En la sección de sesión cerrada (línea 201-207), agregar `<ConsultationSummaryCard consultationId={consultationId} />` antes del mensaje de "Sesión cerrada"

### Archivo 2: `src/pages/Chat.tsx`
- Línea 34: Cambiar el estado inicial de `chatFilter` para que si `role === 'resident'`, el default sea `'doctors'`
- Líneas 267-272: Fix `getSessionDisplayInfo` para usar comparación por `user?.id` en vez de asumir roles fijos

### Archivo 3: `src/components/meetings/MeetingCreateDialog.tsx`
- Para residentes: filtrar la búsqueda de invitados cruzando con `doctor_resident_connections` donde `status = 'accepted'`
- Obtener primero los doctor_ids aceptados, luego filtrar los resultados de búsqueda

### Archivo 4: `src/pages/MedicalRecord.tsx`
- Agregar una sección o tab "Resúmenes Médicos" que liste todos los `consultations` del paciente que tengan `doctor_summary` rellenado, mostrando `ConsultationSummaryCard` para cada uno

### Archivos i18n (es.ts, en.ts)
- Agregar claves para "Resúmenes médicos" / "Medical summaries" para MedicalRecord

No se requieren migraciones de DB.

