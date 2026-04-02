

# Plan: Completar Pendientes + Nuevos Requerimientos (Irene Dichi)

## Resumen de TODO lo que falta

### A. Especialidades completas (México real) — 6 archivos
### B. Enfermedades familiares ampliadas — 1 archivo  
### C. Cartilla de vacunas mexicana completa — 1 archivo
### D. Masterclass en subir contenido — 1 migración DB + 1 archivo
### E. Cédula profesional visible en Lives — 2 archivos

---

## Detalle técnico

### A. Lista completa de especialidades (~35 reales de México)

Agregar las siguientes especialidades faltantes a TODAS las listas `SPECIALTIES` del proyecto (actualmente hay ~17, se amplían a ~35):

**Especialidades a agregar:** Alergología, Anestesiología, Angiología, Cirugía Plástica, Coloproctología, Geriatría, Hematología, Infectología, Medicina Crítica, Medicina de Urgencias, Medicina del Deporte, Medicina Familiar, Medicina Física y Rehabilitación, Nefrología, Neonatología, Neumología, Otorrinolaringología, Patología, Radiología, Reumatología, Traumatología

**Archivos a modificar:**
1. `src/pages/Doctors.tsx` (línea 122-140)
2. `src/pages/RecordingsGrid.tsx` (línea 38+)
3. `src/pages/ContentGallery.tsx` (línea 63+)
4. `src/components/live/LiveSetupForm.tsx` (línea 27+)
5. `src/components/meetings/MeetingCreateDialog.tsx` (línea 18+)
6. `src/pages/ClinicalSessions.tsx` (línea 40+)
7. `src/pages/DoctorUpload.tsx` — `CONTENT_CATEGORIES` (línea 29+)
8. `src/lib/i18n/es.ts` y `en.ts` — agregar claves i18n para las nuevas especialidades

### B. Enfermedades familiares ampliadas

En `src/pages/MedicalRecord.tsx`, ampliar la sección de antecedentes familiares. Actualmente hay 5 (diabetes, hipertensión, cáncer, cardíaca, mental). Agregar:
- Enfermedades renales
- Enfermedades hepáticas
- Enfermedades tiroideas
- Asma/EPOC
- Artritis/Reumatismo
- Epilepsia
- Obesidad
- Alcoholismo/Adicciones
- Alergias hereditarias
- Enfermedades autoinmunes

Implementar con el mismo patrón Switch+Textarea que ya usan los 5 existentes.

### C. Cartilla de vacunas mexicana completa

En `src/pages/MedicalRecord.tsx`, reemplazar la lista `VACCINES` (línea 36-51) con la cartilla oficial mexicana:
- BCG, Hepatitis B, Pentavalente, DPT, Rotavirus, Neumococo conjugada, Neumococo 23, Influenza, SRP (Triple viral), Sabin (Polio oral), Salk (Polio inyectable), SR (Sarampión-Rubéola), VPH, Hepatitis A, Tétanos/Td, Tdpa, COVID-19, Meningococo, Varicela, Fiebre amarilla, Rabia

Cada vacuna mantiene el esquema actual: `{ applied: boolean, doses: string, date: string }`

### D. Masterclass en subir contenido

**Nuevo requerimiento de Irene:** Al subir contenido, agregar tipo "Masterclass" que permite:
- Definir número de sesiones
- Programar fecha y hora de cada sesión
- Se vincula al calendario de disponibilidad

**Cambios:**

1. **Migración DB:** Agregar valor `masterclass` al enum `content_type` y agregar columnas opcionales a `doctor_content`:
   - `is_masterclass boolean DEFAULT false`
   - `masterclass_sessions jsonb DEFAULT null` — array de `{ session_number, title, scheduled_at, duration_minutes }`

2. **`src/pages/DoctorUpload.tsx`:** Agregar un toggle/selector "Tipo: Contenido único / Masterclass". Si es Masterclass:
   - Mostrar campo para número de sesiones
   - Por cada sesión: título, fecha, hora, duración estimada
   - Guardar en `masterclass_sessions` como JSON
   - El `type` se guarda como `'presentation'` (ya existe) pero con `is_masterclass = true`

### E. Cédula profesional visible en Lives

**Nuevo requerimiento de Irene:** En la tarjeta del doctor dentro de los Lives, mostrar su cédula profesional.

**Cambios:**

1. **`src/contexts/LivesContext.tsx`:** En la interfaz `Live`, agregar campo `doctorCedula?: string`. Al hacer fetch de lives, también consultar `doctor_profiles` para obtener `cedula_profesional` y agregarlo al cache/objeto Live.

2. **`src/pages/LivePlayer.tsx`:** En la tarjeta "Doctor Info Card" (línea ~620-674), mostrar la cédula debajo de la especialidad:
   ```
   Céd. Prof.: 12345678
   ```

---

## Archivos a crear/modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/Doctors.tsx` | Ampliar SPECIALTIES |
| `src/pages/RecordingsGrid.tsx` | Ampliar SPECIALTIES |
| `src/pages/ContentGallery.tsx` | Ampliar SPECIALTIES |
| `src/components/live/LiveSetupForm.tsx` | Ampliar SPECIALTIES |
| `src/components/meetings/MeetingCreateDialog.tsx` | Ampliar SPECIALTIES |
| `src/pages/ClinicalSessions.tsx` | Ampliar SPECIALTIES |
| `src/pages/DoctorUpload.tsx` | Ampliar categorías + agregar modo Masterclass |
| `src/pages/MedicalRecord.tsx` | Ampliar enfermedades familiares + vacunas |
| `src/lib/i18n/es.ts` | Claves para nuevas especialidades |
| `src/lib/i18n/en.ts` | Claves para nuevas especialidades |
| `src/contexts/LivesContext.tsx` | Agregar `doctorCedula` al modelo Live |
| `src/pages/LivePlayer.tsx` | Mostrar cédula en tarjeta del doctor |
| **Migration SQL** | `is_masterclass` + `masterclass_sessions` en `doctor_content` |

