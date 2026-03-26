

# Plan: Fase 4 (Chat dos ventanas) + Fase 6 (Residentes, Resumen post-consulta)

---

## Fase 4: Chat con dos ventanas (Pacientes / Doctores)

### Concepto
Para doctores y residentes, el chat mostrará dos pestañas superiores de filtrado: **"Pacientes"** y **"Doctores/Residentes"**, que filtran las sesiones por el tipo de participante contrario. Esto reemplaza la vista plana actual.

Para residentes: solo verán la pestaña "Doctores" (no pueden chatear con pacientes, ya bloqueado en `ChatContext`).

### Cambios

**1. `src/pages/Chat.tsx`**
- Permitir acceso a residentes (actualmente línea 281 bloquea todo excepto `patient` y `doctor`)
- Agregar estado `chatFilter: 'all' | 'patients' | 'doctors'` 
- Para doctores: mostrar tabs `Pacientes | Doctores` antes de la lista de sesiones
- Para residentes: mostrar solo `Doctores` (sin tab de Pacientes)
- Para pacientes: sin cambio (solo ven doctores)
- Filtrar `activeSessions` y `closedSessions` según el tipo del otro participante

**2. `src/components/chat/ChatSessionsList.tsx`**
- Recibir nueva prop `chatFilter` para mostrar las tabs de filtro en el header
- Agregar chips/tabs `Pacientes | Doctores` dentro del CardHeader (solo visible para doctor/resident)

**3. i18n (`es.ts`, `en.ts`)**
- Agregar claves: `chat.filterPatients`, `chat.filterDoctors`, `chat.filterAll`

---

## Fase 6: Funciones de Residentes + Resumen Post-consulta

### 6A: Resumen Post-consulta del Doctor

El doctor debe llenar un resumen después de cerrar una consulta/sesión de chat.

**Migración DB:**
- Agregar columnas a `consultations`: `doctor_summary TEXT`, `doctor_recommendations TEXT`, `completed_at TIMESTAMPTZ`

**Nuevo componente: `src/components/chat/PostConsultationSummaryDialog.tsx`**
- Dialog modal que aparece cuando el doctor cierra una sesión de chat
- Campos: Resumen de la consulta, Diagnóstico/Impresión, Recomendaciones
- Guarda en `consultations` con `doctor_summary`, `diagnosis`, `notes`
- Se activa en `Chat.tsx` al cerrar sesión (después de `closeSession`)

**Visualización para paciente: `src/components/chat/ConsultationSummaryCard.tsx`**
- Card que muestra el resumen del doctor al paciente
- Visible en la sección de historial del chat cerrado
- También visible en Expediente Médico del paciente

### 6B: Red de Residentes (Inscribirse → Doctor acepta → Reuniones)

**Migración DB:**
- Crear tabla `doctor_resident_connections`:
  ```
  id UUID PK
  doctor_id UUID NOT NULL REFERENCES auth.users
  resident_id UUID NOT NULL REFERENCES auth.users  
  status TEXT DEFAULT 'pending' (pending/accepted/rejected)
  created_at TIMESTAMPTZ DEFAULT now()
  responded_at TIMESTAMPTZ
  UNIQUE(doctor_id, resident_id)
  ```
- RLS: residentes pueden insertar (solicitar), doctores pueden actualizar status de sus propias conexiones, ambos pueden leer las suyas

**Nuevo componente: `src/components/doctor/DoctorResidentRequests.tsx`**
- Panel en el dashboard del doctor que muestra solicitudes pendientes de residentes
- Botones Aceptar/Rechazar

**Modificar `src/pages/Doctors.tsx`** (vista de residente)
- Cuando un residente ve el directorio, el botón de acción cambia a "Solicitar conexión" en vez de "Consultar"
- Si ya está aceptado, muestra "Conectado" y habilita chat/reuniones

**Modificar `src/pages/Meetings.tsx`**
- Para residentes: solo pueden crear reuniones con doctores que los hayan aceptado (filtrar por `doctor_resident_connections` con status `accepted`)

### 6C: Balance de Residentes (cuánto gastaron/vendieron)

**Nuevo componente: `src/components/resident/ResidentBalanceCard.tsx`**
- Card con dos métricas: Total Gastado (purchases) y Total Ganado (earnings de contenido vendido)
- Consulta `wallet_transactions` filtrando por tipo `purchase` vs `earning`

**Modificar `src/pages/UserProfile.tsx`**
- Si el rol es `resident`, mostrar `ResidentBalanceCard` en su perfil

---

## Archivos a crear/modificar

| Archivo | Acción |
|---------|--------|
| `src/pages/Chat.tsx` | Modificar: permitir residentes, agregar filtro por tipo |
| `src/components/chat/ChatSessionsList.tsx` | Modificar: agregar tabs Pacientes/Doctores |
| `src/components/chat/PostConsultationSummaryDialog.tsx` | **Crear**: dialog de resumen post-consulta |
| `src/components/chat/ConsultationSummaryCard.tsx` | **Crear**: card de visualización del resumen |
| `src/components/doctor/DoctorResidentRequests.tsx` | **Crear**: panel de solicitudes de residentes |
| `src/components/resident/ResidentBalanceCard.tsx` | **Crear**: card de balance gastado/ganado |
| `src/pages/Doctors.tsx` | Modificar: botón "Solicitar conexión" para residentes |
| `src/pages/Meetings.tsx` | Modificar: filtrar invitados por conexiones aceptadas |
| `src/pages/DoctorDashboard.tsx` | Modificar: agregar panel de solicitudes de residentes |
| `src/pages/UserProfile.tsx` | Modificar: agregar ResidentBalanceCard |
| `src/lib/i18n/es.ts` | Agregar claves i18n |
| `src/lib/i18n/en.ts` | Agregar claves i18n |

**Migraciones DB:**
1. `ALTER TABLE consultations ADD COLUMN doctor_summary TEXT, ADD COLUMN doctor_recommendations TEXT, ADD COLUMN completed_at TIMESTAMPTZ`
2. `CREATE TABLE doctor_resident_connections (...)` con RLS policies

