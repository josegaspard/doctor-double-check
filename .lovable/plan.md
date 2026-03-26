

# Auditoría completa: Problemas encontrados y correcciones necesarias

He revisado a fondo todo el código implementado en las fases 1-5 más las calculadoras y el ContentGallery. Aquí está el resultado honesto:

---

## Problemas encontrados

### 1. Error en consola: `DoctorAvailability` — Popover ref warning
El console log muestra un warning de React: `Function components cannot be given refs` en `DoctorAvailabilityPage`. Esto ocurre porque un `<Popover>` envuelve un componente funcional sin `forwardRef`. No rompe funcionalidad pero genera ruido en consola.

**Fix**: Envolver el componente hijo de Popover con `React.forwardRef` o usar un `<div>` wrapper.

### 2. Chat: NO tiene las dos ventanas (Pacientes / Doctores) — Fase 4 pendiente
El cliente pidió explícitamente que el chat tenga **dos ventanas**: una pestaña para pacientes y otra para doctores. Actualmente `Chat.tsx` tiene una sola lista con tabs `active/history`. **Esta fase completa está pendiente.**

**Fix (Fase 4)**: Añadir tabs `Pacientes | Doctores` que filtren las sesiones por `participant_type`. Para residentes, restringir que solo puedan chatear con doctores (no con pacientes).

### 3. Meetings: Strings hardcoded en español, no usan i18n
En `Meetings.tsx`, líneas 145, 248, 250, 271-275, 293 usan strings directos como `"Invitación aceptada"`, `"Próximas"`, `"Historial"`, `"No tienes reuniones próximas"`, `"Agendar reunión"`, `"Sin historial de reuniones"`. No pasan por `t()`.

**Fix**: Reemplazar con claves i18n existentes o nuevas.

### 4. MeetingCreateDialog: Busca en `profiles` sin filtrar por rol
La búsqueda de invitados (`MeetingCreateDialog.tsx:54-58`) busca en toda la tabla `profiles` sin filtrar por doctor/residente. Un paciente podría aparecer como invitado.

**Fix**: Filtrar buscando solo usuarios que tengan rol `doctor` o `resident` (join con `user_roles` o usar `doctor_profiles`).

### 5. MedicalRecord: Usa `(record as any)` masivamente
Los campos de la migración (family_diabetes, habit_alcohol, vaccines, etc.) no están en los tipos generados de Supabase (`types.ts`). Se usa `as any` en ~40 líneas. Funcional pero sin type-safety.

**Fix**: Los tipos se regeneran automáticamente. No bloquea, pero los `as any` podrían fallar silenciosamente si un campo se renombra.

### 6. Meetings: `daily_room_url`, `daily_room_name`, `meeting_notes` usan `as any`
Misma situación — los campos añadidos por migración no están en los tipos generados.

### 7. ContentGallery/RecordingsGrid: No tiene filtro de "Presentaciones"
El cliente pidió que las presentaciones aparezcan como tipo de contenido. Los `CONTENT_TYPES` tienen `video, pdf, image` pero no `presentation`. Un PDF categorizado como presentación no tiene un filtro dedicado.

**Fix**: Agregar un filtro "Presentaciones" que filtre por `category === 'Presentación'` o un nuevo type.

### 8. Resumen post-consulta del doctor — Pendiente (Fase 6)
El cliente pidió que después de cada consulta el doctor llene un resumen. No existe formulario ni campo para esto.

### 9. Red de residentes (inscribir → aceptar → reuniones) — Pendiente (Fase 6)
El flujo de residentes subscribiéndose a doctores, siendo aceptados, y luego accediendo a reuniones no está implementado.

### 10. Resident: cuánto gastaron/vendieron — Pendiente (Fase 6)
No hay vista de balance de gastos/ventas para residentes.

### 11. Toggle `show_content_medical` oculta ContentGallery pero debería controlar "Contenido Médico" separado
El toggle `show_content_medical` controla la visibilidad de `/content` (Contenido Premium) en la navegación. Pero el cliente quiso ocultar "Contenido Médico" (una sección diferente), no el Contenido Premium. El nombre del toggle es confuso y podría estar mal aplicado.

**Fix**: Renombrar a algo más claro o verificar que el toggle correcto se aplica a la sección correcta.

### 12. Móvil: Resident bottom tabs no incluyen Contenido Premium
El bottom nav para residentes tiene `Lives, Recordings, Chat, Meetings`. El cliente pidió que residentes tengan `Lives, Contenido Premium, Chat, Reuniones`.

**Fix**: Cambiar `recordings` por `content` en los tabs de residente en `getBottomTabs()`.

---

## Resumen de estado

| Feature | Estado | Problema |
|---------|--------|----------|
| Calendar disponibilidad | ✅ Funcional | Warning de ref en consola |
| Toggles admin | ✅ Funcional | Nombre de toggle confuso |
| Expediente Médico | ✅ Funcional | `as any` masivo |
| Calculadoras salud | ✅ Funcional | OK |
| Reuniones Daily.co | ✅ Funcional | Strings hardcoded, búsqueda sin filtro de rol |
| ContentGallery sidebar | ✅ Funcional | Falta filtro "Presentaciones" |
| RecordingsGrid sidebar | ✅ Funcional | OK |
| Chat dos ventanas | ❌ Pendiente | Fase 4 completa no implementada |
| Resumen post-consulta | ❌ Pendiente | Fase 6 |
| Red de residentes | ❌ Pendiente | Fase 6 |
| Bottom nav residente | ⚠️ Incorrecto | Muestra recordings en vez de content |

---

## Plan de correcciones inmediatas (este paso)

### Archivos a modificar:

1. **`src/components/layout/MainLayout.tsx`** — Fix tabs de residente: cambiar `recordings` → `content` (Contenido Premium)
2. **`src/pages/Meetings.tsx`** — Reemplazar ~8 strings hardcoded por claves i18n
3. **`src/components/meetings/MeetingCreateDialog.tsx`** — Filtrar búsqueda de invitados solo a doctores/residentes
4. **`src/pages/ContentGallery.tsx`** — Agregar "Presentaciones" como filtro de tipo
5. **`src/pages/DoctorAvailability.tsx`** — Fix Popover ref warning con div wrapper

### Archivos de i18n:
6. **`src/lib/i18n/es.ts`** — Agregar claves faltantes de Meetings
7. **`src/lib/i18n/en.ts`** — Agregar claves faltantes de Meetings

Las fases 4 (Chat dos ventanas) y 6 (Residentes, resumen post-consulta) quedan como siguientes pasos.

