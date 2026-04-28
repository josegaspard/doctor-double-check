# Plan multifase: cambios solicitados por el cliente

Son ~20 cambios mezclando UX, datos clínicos sensibles, features nuevas e infra. Los agrupo en **6 fases** ordenadas por prioridad e impacto. Apruebas fase por fase para no romper nada y para que sigamos pendientes en lo que falta clarificar (Hospitales y política de re-login).

Decisiones ya confirmadas:

- Vault → **"Expediente Seguro"**
- Hijos → **sub-perfiles ligados sin login propio** (la madre los gestiona, a los 18 se invita al hijo a heredar el expediente)
- Hospitales → **pendiente** (cliente lo pregunta luego, no se toca esta iteración)
- Re-login al salir → **pendiente** (cliente lo va a confirmar, no se toca esta iteración)

---

## Fase 1 — Quick wins de UI/copy (sin migración)

Cambios de texto, orden y filtros. Cero riesgo, alto impacto visible.

1. **Renombrar "Soy Médico" → "Directorio Médico"** en `MainLayout`, sidebar móvil, traducciones (`i18n/es.ts`, `i18n/en.ts`).
2. **Renombrar "Acceso" → "Expediente Seguro"** en panel del usuario (rutas, breadcrumbs, navegación, icono se mantiene).
3. **Reordenar menú principal**: `Lives` · `Contenido Premium` · `Medical Masters Education` · `Chat` · `Disponibilidad` · `Más`. Todo lo demás se mueve dentro del dropdown "Más".
4. **Sidebar de Contenido Premium**: dejar solo filtros `Todo / Gratis / Pagado`. Quitar el resto.
5. **Calculadoras**: quitar tab "Glasgow"; en `IMC` cambiar etiqueta `Delgadez severa` → `Bajo peso`.
6. **Copy "consulta gratis" → "orientación médica"** donde aparezca (consistencia con la memoria del proyecto).

Archivos: `src/components/layout/MainLayout.tsx`, `src/components/layout/UnifiedFooter.tsx`, `src/lib/i18n/es.ts`, `src/lib/i18n/en.ts`, `src/pages/ContentGallery.tsx`, `src/components/medical/HealthCalculators.tsx`.

---

## Fase 2 — Historial clínico extendido

Cambios al esquema dinámico JSON del expediente. Requiere migración mínima (los campos viven en JSON, no en columnas nuevas) más cambios de UI.

1. **Sección "Hijos"** visible solo si `gender = 'female'`:
  - Botón "Agregar hijo/a" → crea registro en nueva tabla `child_profiles` (sub-perfil ligado, sin `auth.users`).
  - Cada hijo tiene su propio JSON de historial clínico pediátrico.
  - A los 18 años, banner "Invita a tu hijo/a a crear su cuenta y heredar el expediente".
2. **Enfermedades crónicas**: agregar opción **"Otras"** con sub-campos: `cuál`, `diagnóstico`, `tratamiento`, `fecha`.
3. **Nuevos bloques** en historial personal: `Cirugía previa` (descripción + fecha + complicaciones) y `Complicaciones` generales.
4. **Antecedentes familiares**: rediseñar de toggle global → matriz `enfermedad × parentesco` (Mamá, Papá, Hijos, Abuelos). Se guarda como `{ "diabetes": ["mama","abuelos"], "hipertension": ["papa"] }`.
5. **Hábitos**:
  - Renombrar `Alcohol` → `Alcoholismo` + sub-campos (qué bebida, frecuencia, cantidad).
  - Eliminar filas sueltas de Cigarro, Vape, Arguile.
  - Crear categoría `Tabaquismo` que contiene las 3 sub-opciones (Cigarro / Vape / Arguile-Hookah) cada una con frecuencia + cantidad.
  - Mantener `Otras drogas` con frecuencia + cantidad.
  - Renombrar `Ejercicio` → `Actividad física` + sub-campo `tipo de actividad`.

Archivos clave: `src/components/profile/PatientClinicalHistoryCard.tsx`, `src/pages/MedicalHistory.tsx`, `src/pages/MedicalRecord.tsx`, nueva migración para `child_profiles`.

---

## Fase 3 — Vacunación SSA México + notificaciones

1. **Reestructurar vacunas** según el esquema oficial mexicano (las fotos amarillas que adjuntó el cliente):
  - Grupo `0–9 años`: BCG, Hepatitis B, Hexavalente acelular, Rotavirus, Antineumocócica conjugada, Influenza, SRP, Anti-varicela, COVID-19 pediátrico, etc., con la edad/mes de aplicación.
  - Grupo `10–19 años y adultos 20+`: Td, SR, Anti-hepatitis B, VPH, Tdpa, Influenza estacional, COVID-19, Antineumocócica 13v.
  - Cada vacuna: checkbox aplicada + fecha + dosis.
2. **Recordatorio automático** al paciente:
  - Edge function `send-vaccination-reminders` (cron diario).
  - Notificación push + email cuando: cumple edad de una vacuna pendiente, o pasaron 12 meses desde la última revisión.
  - Toggle de opt-in en preferencias del paciente.

Archivos: nuevo `src/components/medical/VaccinationSchedule.tsx`, `supabase/functions/send-vaccination-reminders/`, migración para tabla `patient_vaccinations`.

---

## Fase 4 — Videollamada profesional para el doctor

Cambios significativos en la UI de `VideoCall.tsx`:

1. **Layout de 2 columnas durante la llamada** (desktop): video a la izquierda, panel del expediente del paciente a la derecha (tabs: Personal / Familia / Hábitos / Vacunas / Estudios).
2. **Bloquear que el paciente inicie la llamada** — el botón "Llamar" solo se renderiza para el doctor; el paciente solo puede `aceptar` una llamada entrante.
3. **Buscador de paciente** desde el panel del doctor (por nombre, email, teléfono).
4. **Datos del doctor visibles antes/durante la llamada**: Cédula profesional, # COFEPRIS, nombre completo. Se lee de `doctor_profiles` (campos ya existen) más uno nuevo `cofepris_number`.
5. **Al colgar (doctor)** → modal/redirección automática al **informe post-consulta** (ya existe, hay que conectarlo al evento `call-ended` de la videollamada).

Archivos: `src/pages/VideoCall.tsx`, `src/components/videocall/`, migración para `cofepris_number` en `doctor_profiles`.

---

## Fase 5 — Chat & Live mejorado

1. **Reply/Responder** a un mensaje específico:
  - Migración: agregar `reply_to_message_id uuid` en `chat_messages` y `live_chat_messages`.
  - UI: swipe / menú contextual → quote del mensaje original arriba del input.
2. **Chat lateral en lives** (desktop): cambiar layout de live de "video full + chat overlay" a "video 70% / chat 30% sticky" para que el render del chat no congele el video (problema reportado).
3. **Lives se guardan**: revisar webhook de Cloudflare/Daily — confirmar que la grabación se guarda con `default_retention = 24h` (ya en memoria) y exponer toggle "Guardar permanentemente" para el doctor.
4. **Suscriptores visibles para el doctor**: nueva pantalla `/dashboard/subscribers` con lista de quienes están suscritos (nombre, fecha, tier). Query a `subscriptions` filtrado por `creator_id = auth.uid()`. RLS ya lo permite.

Archivos: `src/pages/Chat.tsx`, `src/pages/LivePlayer.tsx`, `src/components/chat/`, nueva página `src/pages/DoctorSubscribers.tsx`, migraciones de chat.

---

## Fase 6 — Aviso legal + investigación de bugs de infra

1. **Aviso de orientación** (texto que mandó el cliente, ambas versiones):
  - Versión larga: modal obligatorio antes de iniciar orientación (debe aceptarse).
  - Versión corta: banner persistente arriba del chat de orientación.
  - Guardar aceptación en tabla `disclaimer_acceptances` con timestamp.
2. **Investigación de bugs reportados** (no se promete fix, primero diagnóstico):
  - "Se traba con muchos usuarios": revisar suscripciones realtime activas, índices en tablas calientes (`chat_messages`, `lives`, `viewer_count`), N+1 en queries del feed.
  - "No deja guardar el expediente": reproducir + revisar logs de Postgres y de la edge function.
  - "Lives no se guardan siempre": revisar logs de `cloudflare-webhook` y `daily-webhook`, confirmar que el evento `recording.ready` siempre llega.

Estos 3 bugs los investigo con `supabase--analytics_query` y `supabase--edge_function_logs` antes de proponer cambios.

---

## Lo que queda fuera (esperando definición del cliente)

- **Hospitales** vs Directorio Médico: el cliente quiere preguntar mejor. No se toca.
- **Política de re-login al salir**: el cliente quiere pensarlo. No se toca.

---

## Recomendación de orden

Sugiero arrancar por **Fase 1** (visible, rápido, cero riesgo) + **Fase 6.1** (aviso legal, también pequeño). Eso ya da al cliente sensación de progreso. Después atacamos Fases 2 y 3 (las más grandes en datos clínicos), y finalmente 4–5 que son cambios de producto más pesados.  
EJECUTA TODO

&nbsp;