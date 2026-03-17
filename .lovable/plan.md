

# Plan: Implementar Pendientes P3, P4 (Vault), P6, P8, P11, P12, P13, P14

## Correcciones del análisis previo
- **P1 (buscador en chat)** — YA EXISTE en `ChatSessionsList.tsx` (líneas 121-165)
- **P4 (drag & drop en DoctorUpload)** — YA EXISTE (líneas 306-308)
- Solo falta drag & drop en **Vault.tsx**

---

## Cambios a implementar

### 1. P8 — Badges App Store/Google Play con colores oficiales
**Archivo:** `src/components/layout/UnifiedFooter.tsx`
- Reemplazar los badges monocromáticos blancos por el estilo oficial: fondo negro sólido (`bg-black`), iconos con colores reales, texto blanco
- Apple: icono blanco sobre fondo negro
- Google Play: triángulo multicolor (o icono blanco) sobre fondo negro

### 2. P3 — Doctor elige si el live se queda en su perfil
**Archivos:** `src/components/live/EndingLiveModal.tsx`, `src/components/live/LiveDialogs.tsx`
- Agregar stage `'choose'` entre `'saving'/'uploading'` y `'done'` cuando `enableRecording=true`
- Mostrar dos botones: "Guardar en mi perfil" y "No guardar"
- Pasar callback `onKeepDecision: (keep: boolean) => void` al modal
- En `LiveDialogs.tsx`, manejar la decisión: si `keep=false`, eliminar la grabación de la tabla `recordings`

### 3. P4 (Vault) — Drag & drop para archivos
**Archivo:** `src/pages/Vault.tsx`
- Agregar `onDragOver`, `onDragLeave`, `onDrop` al área de upload (mismo patrón que `DoctorUpload.tsx` líneas 303-308)
- Highlight visual al arrastrar archivos sobre la zona

### 4. P6 — Especialidades como sidebar/filtro lateral en Doctores
**Archivo:** `src/pages/Doctors.tsx`
- En desktop (`lg+`): convertir el layout a dos columnas con sidebar izquierdo fijo que muestre especialidades y ciudades como lista clickeable vertical (no chips horizontales)
- En mobile: mantener los chips horizontales actuales (scroll horizontal)
- El sidebar muestra: título "Especialidades" + lista vertical de botones, luego "Ciudades" + lista vertical

### 5. P11 — Foto de perfil editable desde dashboard doctor
**Archivo:** `src/pages/DoctorDashboard.tsx`, nuevo componente `src/components/doctor/DoctorProfileCard.tsx`
- Crear card con avatar grande del doctor, nombre, especialidad, y botón de editar foto
- Click en avatar abre selector de archivo, sube a storage y actualiza `profiles.avatar_url`
- Colocar como primera sección del tab "overview", antes del StatsGrid

### 6. P12 — Pacientes visibles en dashboard doctor
**Archivo:** `src/pages/DoctorDashboard.tsx`, nuevo componente `src/components/doctor/DoctorPatientsList.tsx`
- Query a `chat_sessions` para obtener pacientes únicos que han tenido sesión con el doctor
- Mostrar lista con avatar, nombre, última interacción
- Colocar debajo del ProfileCard en el tab overview

### 7. P13 — Categorías en grabaciones
**Archivo:** `src/pages/RecordingsGrid.tsx`
- Las grabaciones ya tienen `tags` (array de strings) y `specialty`
- Agregar chips de filtro por tags comunes: "Cirugía", "Caso Clínico", "Procedimiento", etc.
- Filtrar `recordings` por tag seleccionado además de specialty

### 8. P14 — Grabaciones compradas sin gratuitas
**Archivo:** `src/pages/RecordingsGrid.tsx`
- El filtro `'purchased'` actual (línea 90) incluye grabaciones gratuitas (`ownsRecording` retorna true si `price === 0`)
- Cambiar lógica: `case 'purchased': return owned && rec.price > 0;` para excluir las gratuitas del tab de compradas

---

## Archivos a modificar
1. `src/components/layout/UnifiedFooter.tsx` — P8
2. `src/components/live/EndingLiveModal.tsx` — P3
3. `src/components/live/LiveDialogs.tsx` — P3
4. `src/pages/Vault.tsx` — P4
5. `src/pages/Doctors.tsx` — P6
6. `src/pages/DoctorDashboard.tsx` — P11, P12
7. `src/pages/RecordingsGrid.tsx` — P13, P14

## Archivos nuevos
1. `src/components/doctor/DoctorProfileCard.tsx` — P11
2. `src/components/doctor/DoctorPatientsList.tsx` — P12

## Nota sobre P9 y P10
- **P9 (Facturación sistema separado):** Requiere integración con API contable externa (SAT/Facturapi). No se puede implementar sin definir proveedor.
- **P10 (KYC/AML formal):** Requiere un proveedor de compliance (Chainalysis, ComplyAdvantage, etc.). Fuera del scope actual.

