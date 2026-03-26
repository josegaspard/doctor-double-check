

# Plan: Reestructuración completa por fases (empezando por Disponibilidad tipo Calendar)

Tu cliente pide ~40 cambios. Para hacerlo bien sin romper nada, lo divido en **6 fases**. Empezamos por tu prioridad: **Disponibilidad tipo Google Calendar**.

> **Nota importante**: Todo lo que el cliente pide "quitar" se **ocultará** mediante toggles controlables desde el panel de superadministrador (site_settings), no se eliminará código.

---

## Fase 1 — Disponibilidad tipo Google Calendar (AHORA)

**Archivo**: `src/pages/DoctorAvailability.tsx`

Rediseñar la página de disponibilidad para que se vea como Google Calendar:

1. **Vista mensual con calendario visual**: Reemplazar la lista actual de tarjetas por una vista de calendario mensual donde cada día muestre las disponibilidades programadas como bloques de color
2. **Tipos de evento con colores**:
   - `disponible` (verde) — horario disponible para consultas
   - `live` (rojo) — transmisión en vivo programada  
   - `orientacion` (azul) — sesión de orientación médica
   - Quitar "orientacion" como tipo según lo pide el cliente (ocultarlo vía toggle)
3. **Vista semanal/diaria**: Agregar tabs para cambiar entre vista mensual, semanal y diaria
4. **Crear evento**: Click en un día abre el formulario de creación (mantener el dialog existente)
5. **Drag & visual**: Los eventos aparecen como chips coloreados dentro de las celdas del calendario

**Detalles técnicos**:
- Usar el componente `Calendar` de shadcn como base pero extenderlo con una grilla personalizada para mostrar eventos dentro de cada celda
- Reutilizar el hook `useDoctorAvailability` existente
- Mantener toda la lógica existente de confirmación, notificación y cancelación

---

## Fase 2 — Navegación y renombramientos (siguiente)

**Archivos**: `src/components/layout/MainLayout.tsx`, `src/lib/i18n/es.ts`, `src/lib/i18n/en.ts`

**Por rol:**

| Cambio | Doctor | Paciente | Residente |
|--------|--------|----------|-----------|
| Quitar Noticias del menú | ✅ (toggle) | ✅ (toggle) | ✅ (toggle) |
| "Grabaciones" → "Contenido Premium" | ✅ | ✅ | ✅ |
| "Recetas" → "Reuniones" | ✅ | — | ✅ |
| Quitar "Contenido Médico" | ✅ (toggle) | — | — |
| Agregar "Expediente Médico" para paciente | — | ✅ (reemplaza Vault) | — |

**Navegación por rol (bottom tabs mobile):**
- **Doctor**: Lives, Contenido Premium, Chat, Panel
- **Paciente**: Lives, Contenido Premium, Doctores, Chat  
- **Residente**: Lives, Contenido Premium, Chat, Reuniones

---

## Fase 3 — Expediente Médico del paciente

**Archivos nuevos**: `src/pages/MedicalRecord.tsx`, componentes de formulario  
**Migración DB**: Nueva tabla o extensión de `patient_clinical_history`

Formulario completo con secciones:
1. **Datos personales** (nombre, fecha nacimiento, etc.)
2. **Antecedentes familiares** — campos Sí/No con textarea condicional
3. **Hábitos**: Alcohol (frecuencia), Cigarro/Vape/Arguile (frecuencia)
4. **Ginecología** — solo visible para mujeres, con campo de resultados
5. **Vacunas** — cartilla de vacunación con checkboxes marcables
6. **Subir estudios** — laboratorio, radiografía, gabinete (al final)
7. **Calculadoras de salud** — IMC, riesgo cardiovascular, Glasgow
8. **Referencias** — sección para referencias médicas

El Vault actual se redirige a esta sección de Historia Clínica.

---

## Fase 4 — Chat: dos ventanas y restricciones por rol

**Archivo**: `src/pages/Chat.tsx`, `src/contexts/ChatContext.tsx`

1. **Dos tabs en el chat**: "Pacientes" y "Doctores" (para doctores)
2. **Restricciones**: Residentes solo pueden chatear con doctores (no pacientes)
3. **Chat en Lives gratis** para doctores (quitar cobro de chat en lives)
4. **Chat para pacientes**: solo visible con suscripción activa

---

## Fase 5 — Reuniones (reemplaza Recetas)

**Archivos**: `src/pages/Meetings.tsx` (nuevo), reutilizar infraestructura Daily  

1. Reutilizar Daily.co para videollamadas grupales
2. Reuniones: residentes con doctores, y con pacientes
3. Agendar, aceptar invitaciones, historial de reuniones
4. Resumen post-consulta que el doctor debe llenar

---

## Fase 6 — Directorio de doctores y contenido premium

1. **Doctores sin opción de consulta** (para doctores y residentes que ven el directorio)
2. **Contenido Premium**: incluir presentaciones + grabaciones
3. **Residentes**: pueden comprar presentaciones, subir contenido para vender
4. **Red de doctores**: para residentes, con inscripción → aceptación → reuniones
5. **Sección financiera para residentes**: cuánto han gastado y vendido

---

## Toggles de Admin (se implementa en Fase 2)

En `site_settings` agregar toggles para cada feature "quitada":
- `show_news_section` (default: false)
- `show_content_medical` (default: false)  
- `show_prescriptions` (default: false)
- `live_chat_free` (default: true)
- `show_transaction_history` (default: false)

Esto permite reactivar cualquier feature sin tocar código.

---

## Empezamos ahora con Fase 1

Voy a rediseñar `DoctorAvailability.tsx` para que tenga una vista tipo Google Calendar con eventos coloreados por tipo, vista mensual con opción semanal, y el formulario de creación al hacer click en un día.

