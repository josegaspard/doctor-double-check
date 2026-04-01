

# Auditoría Completa: Correcciones Fernanda (30 marzo 2026)

## Resumen: ~60% hecho, ~40% pendiente

---

## MÉDICOS

### 1. Farmacéuticas (pestaña nueva después de disponibilidad)
**❌ NO HECHO** — No existe ninguna funcionalidad de farmacéuticas. Se necesita crear una página nueva, una tabla en DB, y un nav item. Es una feature completamente nueva (marketplace de productos farmacéuticos con pago para promoción).

### 2. Lives: Solo chat de pago → "Solo chat de pacientes suscritos"
**⚠️ PARCIAL** — Existe `chatMode: 'paid_only'` pero su descripción dice "Solo pueden comentar quienes paguen por mensaje". Falta la opción específica de "solo pacientes suscritos" (que ya pagaron suscripción) sin cobro adicional por mensaje. La descripción en `LiveSetupForm.tsx` debe cambiarse y la lógica en `LiveChat.tsx` debe verificar suscripción activa en vez de cobrar por mensaje.

### 3. Contenido Premium: Orden de filtros (Acceso primero, luego especialidades) + botón rojo "Subir contenido"
**⚠️ PARCIAL** — Los filtros de acceso (all/free/paid/purchased) existen en `RecordingsGrid.tsx` y `ContentGallery.tsx`, pero no están primero en la UI. No hay botón rojo "Subir contenido" visible para doctores en estas páginas.

### 4. Doctores: Quitar precios de las consultas
**❌ NO HECHO** — `Doctors.tsx` líneas 725 y 858 muestran `PriceDisplay` con `consultation_fee`. Deben eliminarse para todos los usuarios.

### 5. Chat: Quitar "1:1"
**❌ NO HECHO** — `es.ts` y `en.ts` todavía tienen "Chat 1:1" en múltiples claves (líneas 114, 243, 244, 262).

### 6. Reuniones: Tipo de reunión (caso clínico vs clase con residentes)
**❌ NO HECHO** — `MeetingCreateDialog.tsx` no tiene selector de tipo. Se necesita agregar un campo `meeting_type` (ej: 'case_discussion' | 'resident_class') y migración DB.

### 7. Pacientes: Ver location para restricción de receta por país
**❌ NO HECHO** — No existe lógica que muestre la ubicación/país del paciente al doctor ni restricción de recetas por país.

### 8. Panel: Cambiar "Acceso Vault" y "Escribir artículo" → "Subir contenido"
**⚠️ PARCIAL** — `DoctorQuickActions.tsx` línea 29 ya dice "Subir Contenido". Pero línea 48 dice "Escribir Artículo" (debe cambiar a "Subir Contenido" o eliminarse). Y en el Dashboard general, las secciones de Vault necesitan renombrarse.

### 9. Historia clínica personal para doctores (en panel o después)
**❌ NO HECHO** — `MedicalRecord.tsx` línea 311 bloquea acceso: `if (role !== 'patient') return <Navigate to="/lives" replace />`. Los doctores no pueden ver su propio expediente. Debe permitir `role === 'doctor'` también.

### 10. "Publicita en Medical Masters" — Explicar
**✅ HECHO** — Sistema de advertising completo con `AdBanner`, `AdvertiserDashboard`, `AdminAds`, campañas CPM/CPC.

### 11. Localizar un hospital (al final de nav para doctores)
**❌ NO HECHO** — No existe página de "Localizar hospital" con integración de mapa/Waze/Google Maps.

### 12. Completar lista de especialidades
**⚠️ PARCIAL** — Hay ~17 especialidades en las listas. Fernanda pide la lista completa tipo Centro Médico ABC (~30+ especialidades).

### 13. Chat privado solo con suscripción
**✅ HECHO** — El AccessGuard + PaywallModal ya bloquean el chat a usuarios sin entitlement/suscripción.

---

## PACIENTES

### 14. Contenido Premium: Mismo orden que médicos
**❌ NO HECHO** — Se aplica el mismo cambio del punto 3.

### 15. Expediente Médico mejoras detalladas:
- **Enfermedades crónicas con checkbox + recuadro:** **⚠️ PARCIAL** — Antecedentes familiares ya usan Switch+Textarea, pero enfermedades crónicas personales son un simple Textarea libre. Fernanda quiere checkboxes individuales con recuadro para fecha, igual que en familiares.
- **Medicamentos como items individuales (no textarea grande):** **❌ NO HECHO** — Es un solo Textarea. Debe ser un array dinámico donde se agreguen medicamentos uno a uno.
- **Cirugías previas como items individuales:** **❌ NO HECHO** — Mismo problema, es Textarea.
- **Lista específica de enfermedades familiares:** **⚠️ PENDIENTE** — Fernanda dice "te mando la lista". Las 5 actuales (diabetes, hipertensión, cáncer, cardíaca, mental) pueden no ser suficientes.
- **Hábitos con especificación:** **✅ HECHO** — Alcohol, cigarro, vape, hookah, drogas, ejercicio todos con selector de frecuencia.
- **Vacunas con dosis y fecha:** **❌ NO HECHO** — Solo tiene checkbox de aplicada/no aplicada. Falta campos para número de dosis y fecha de aplicación.
- **Estudios: descargar y compartir con médico específico:** **⚠️ PARCIAL** — El botón actual redirige a `/medical-history` pero no tiene descarga directa ni opción de compartir estudio individual a un médico.

### 16. Localizar hospital con distancia + abrir en Waze/Google Maps
**❌ NO HECHO** — No existe esta página.

### 17. Chat: pacientes no pueden entrar a llamada sin pagar + recordatorio
**⚠️ PARCIAL** — Hay AccessGuard que bloquea, pero no existe un sistema de "recordatorio del médico" antes de la llamada.

---

## RESIDENTES

### 18. Contenido Premium: mismo cambio
**❌ NO HECHO** — Mismo punto 3.

### 19. Chat con opción residente-residente o residente-doctor
**⚠️ PARCIAL** — El chat ya permite residente-doctor (con conexión aceptada), pero no residente-residente.

### 20. Historia clínica después de reuniones
**⚠️ PARCIAL** — Nav ya incluye Medical Record para resident, pero el código en `MedicalRecord.tsx` línea 311 bloquea si `role !== 'patient'`.

### 21. Localizar hospital después de historia clínica
**❌ NO HECHO** — Mismo punto 16.

---

## GENERAL

### 22. Filtrar contenido si es para todos o solo médicos/residentes
**✅ HECHO** — `AudienceSelector` con opciones 'all', 'patients', 'professionals', 'subscribers' ya existe en `DoctorUpload.tsx`.

---

## Plan de Implementación (ordenado por prioridad)

### Fase A: Cambios rápidos de texto/UI (sin DB)
1. **Quitar "1:1" del chat** — Reemplazar en `es.ts` y `en.ts` (~6 strings)
2. **Quitar precios de consulta en directorio** — Eliminar `PriceDisplay` en `Doctors.tsx` líneas 725 y 858
3. **Panel doctor: renombrar "Escribir Artículo"** — Cambiar a "Subir Contenido" en `DoctorQuickActions.tsx`
4. **Contenido Premium: reordenar filtros** — Mover access tabs antes de specialty en `RecordingsGrid.tsx` y `ContentGallery.tsx`, agregar botón rojo "Subir contenido" visible para doctores
5. **Lives chat: cambiar descripción "Solo chat de pago"** → "Solo pacientes suscritos" en `LiveSetupForm.tsx`

### Fase B: Cambios de lógica (sin DB migration)
6. **MedicalRecord acceso para doctor y resident** — Cambiar línea 311 de `role !== 'patient'` a `!['patient','resident','doctor'].includes(role)`
7. **Lives chat: verificar suscripción** — En `LiveChat.tsx`, agregar opción de chat `subscribers_only` que valide suscripción activa en vez de cobrar por mensaje

### Fase C: Mejoras al Expediente Médico (migration necesaria)
8. **Medicamentos como array dinámico** — Cambiar de Textarea a lista con botón "Agregar medicamento" (nombre, dosis, frecuencia)
9. **Cirugías como array dinámico** — Igual que medicamentos (procedimiento, fecha)
10. **Vacunas con dosis y fecha** — Expandir de boolean a objeto con `doses` y `date` por vacuna
11. **Enfermedades crónicas con checkboxes** — Convertir de textarea a checkboxes con detalle (similar a antecedentes familiares)

### Fase D: Features nuevas (requieren páginas y posiblemente DB)
12. **Tipo de reunión** — Agregar campo `meeting_type` a `clinical_sessions` table + selector en `MeetingCreateDialog.tsx`
13. **Localizar hospital** — Nueva página con geolocalización, lista de hospitales, enlace a Waze/Google Maps
14. **Location de pacientes para doctores** — Mostrar país del paciente en el chat/perfil, restricción de prescripción por país
15. **Farmacéuticas** — Feature completamente nueva (marketplace). Requiere tabla, página, lógica de pago. **Scope más grande.**

### Archivos principales a modificar:
- `src/lib/i18n/es.ts` y `en.ts` — Terminología
- `src/pages/Doctors.tsx` — Quitar precios
- `src/pages/MedicalRecord.tsx` — Acceso multi-rol + mejoras de formulario
- `src/pages/RecordingsGrid.tsx` y `ContentGallery.tsx` — Reordenar filtros + botón
- `src/components/live/LiveSetupForm.tsx` y `LiveChat.tsx` — Chat suscriptores
- `src/components/meetings/MeetingCreateDialog.tsx` — Tipo de reunión
- `src/components/doctor/DoctorQuickActions.tsx` — Renombrar acciones
- **Nueva página:** `src/pages/HospitalLocator.tsx`
- **Migration:** Campos JSON expandidos en `patient_clinical_history`, campo `meeting_type` en `clinical_sessions`

