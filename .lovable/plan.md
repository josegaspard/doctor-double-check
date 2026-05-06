# Plan: Ajustes UX/UI y funcionalidad solicitados

Voy a abordar 11 cambios agrupados por área. Cada uno tiene inicio, lógica y cierre claros (sin TODOs colgando).

---

## 1. `/profile` — Ficha pública del doctor más completa
**Mostrar siempre (cuando el doctor lo tenga):**
- Universidad de medicina (`titulo_medicina` / nuevo campo `university`)
- Especialidad(es) — soportar múltiples
- Hospitales/clínicas donde trabaja
- Cédula profesional + estado (badge ya existe)
- Cédula de especialidad + estado (nuevo campo `cedula_especialidad`)

**Cambios:**
- Migración: añadir a `doctor_profiles` las columnas `university text`, `secondary_specialties text[]`, `workplaces jsonb` (array de `{name, type, city}`), `cedula_especialidad text`, `cedula_especialidad_status text`, `cedula_especialidad_rejection_reason text`.
- Actualizar `fetchUserProfile.ts` y tipos.
- En `DoctorProfile.tsx`: nueva sección "Credenciales y trayectoria" con grid de chips (Universidad, Especialidades, Lugares de trabajo) y dos `CredentialStatusBadge` (cédula prof. + cédula esp.).
- En `Onboarding` y `Settings` (sección doctor): inputs para editar estos datos.
- Admin: en `AdminCredentials.tsx` agregar revisión de cédula de especialidad (mismo flujo aprobado/rechazado).

---

## 2. `/recordings` — Simplificar filtro ACCESO
- En `RecordingsGrid.tsx` reducir `ContentFilter` a `'all' | 'free' | 'purchased'`.
- Eliminar opciones "De Pago" y "Sin Comprar" del menú lateral y de la lógica de filtrado.

---

## 3. `/doctor/vault` — Agregar pacientes manualmente
- En el tab "Mis Pacientes" añadir botón **"Agregar paciente"** que abre un modal:
  - Buscar por email/teléfono → si existe, vincular.
  - Si no existe, crear paciente "externo" (registro en nueva tabla `external_patients` con `doctor_id, name, email, phone, notes`) que aparece junto a los pacientes reales.
- Migración: tabla `external_patients` con RLS (solo el doctor dueño lee/escribe).
- Reflejarlos en la lista existente con badge "Externo".

---

## 4. `/hospital-locator` — Solo hospitales privados de México + scroll lateral de doctores
- Forzar filtro fijo `country = 'MX'` y `type = 'private'`. Quitar selector Público/Clínica del UI; dejar solo "Privados".
- En el panel de detalle del hospital, la sección **"Médicos relacionados"** pasa de grid a **carrusel horizontal scrolleable** (`overflow-x-auto snap-x` con tarjetas `min-w-[260px]`), flechas prev/next en desktop, swipe en móvil. Cada tarjeta mantiene avatar, nombre, especialidad, rating y CTA.

---

## 5. Header global — Reorganización
Items principales visibles (en este orden):
`Live` · `Contenido Premium` · `Medical Masters` · `Education` · `Chat` · `Disponibilidad` · `Más ▾`

El menú **Más** (Popover/Dropdown) contiene el resto: Doctores, Hospitales, Marketplace, Noticias, Ayuda, Recetas, Vault, etc. (según rol). Refactor en `components/layout/Header*.tsx`.

---

## 6. Landing `/` — "Seguridad Militar" → "Seguridad de nivel empresarial"
- Renombrar bloque a **"Seguridad de grado bancario"** con copy real: cifrado AES-256 en reposo, TLS 1.3 en tránsito, RLS por usuario, cumplimiento NOM-024-SSA3, auditoría completa. Ícono `ShieldCheck`. Quitar referencia "militar".

---

## 7. Landing `/` — Quitar "AI Assistant"
- Eliminar tarjeta "AI Assistant / Pre-diagnóstico y triaje automatizado" del grid de features. Reacomodar grid (3 cols → mantener simetría).

---

## 8. Landing `/` — Reemplazar copy falso por información real
Auditar `Landing.tsx` y sustituir cifras/claims inventados por datos reales del producto:
- Especialidades disponibles (≈35 reales, leídas de `specialties.ts`)
- Funciones reales: Orientación médica por video, Contenido Premium, Reuniones (recetas), Directorio de hospitales, Chat médico, Vault clínico, Verificación SEP/COFEPRIS.
- Si una métrica no se puede comprobar (ej. "10,000 doctores"), reemplazar por copy cualitativo ("Doctores verificados con cédula validada por SEP").

---

## 9. Gating de visitantes en Lives gratis
- En `LivePlayer.tsx` (cuando `role === 'visitor'`): después de N segundos (ej. 60s) o al intentar interactuar (chat/like), mostrar **overlay persistente "Crea tu cuenta gratis para seguir viendo"** con CTA grande a `/login?mode=register`. El visitante puede cerrar y seguir viendo solo el video, pero el CTA se mantiene fijo en esquina inferior. Sin descarga, sin grabación local.
- Bloquear cualquier `download` attribute / context menu en el reproductor para visitantes (ya implementado para PDFs, replicar para video).

---

## 10. Programar curso (lives futuros)
- En `DoctorGoLive.tsx` añadir tab **"Programar"** con datepicker + hora + título + precio + descripción → inserta en `lives` con `status='scheduled'` y `scheduled_at`.
- En `LivesGrid` agregar sección **"Próximamente"** que lista los `scheduled` con countdown y botón "Recordarme" (crea notificación push + email).

---

## 11. Notas visibles en el panel del doctor
- En `DoctorDashboard.tsx` agregar widget **"Mis notas"** que lista las últimas notas clínicas (`consultation_notes` / `medical_summaries`) con scroll, click → abre la consulta correspondiente.
- Si hay tabla `doctor_notes` privada, leerla; si no, crear migración mínima `doctor_notes (doctor_id, patient_id, content, created_at)` con RLS dueño-only y CRUD inline.

---

## Orden de ejecución
1. Migraciones DB (tareas 1, 3, 11) — una sola migración consolidada.
2. Refactor Header (5).
3. Landing copy (6, 7, 8).
4. Recordings filtro (2).
5. Hospital Locator (4).
6. Profile doctor (1).
7. Vault pacientes (3 frontend).
8. Lives visitante + programar (9, 10).
9. Dashboard notas (11).

## Detalles técnicos
- Todas las nuevas columnas/tablas con RLS estricta (dueño o admin).
- Header responsive: en móvil colapsa todo en hamburguesa; "Más" solo aplica desktop ≥ md.
- Carrusel de doctores: usar `embla-carousel-react` (ya en proyecto si existe) o scroll nativo con `scroll-snap`.
- Sin descarga: `controlsList="nodownload noremoteplayback"`, `onContextMenu={e=>e.preventDefault()}`, sin botón share-as-file.
- Copy en español, manteniendo glosario: "Orientación médica", "Contenido Premium", "Reuniones".

¿Apruebas para implementar todo en este orden?
