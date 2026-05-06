# Plan — Cierre de pendientes + Auditoría de Seguridad

## Parte 1 — Pendientes funcionales (frontend)

### 1.1 Fix build error: `HospitalLocator.tsx`
Eliminar las 2 referencias huérfanas a `typeChips` (líneas 360 y 390). Como el cliente pidió hardcodear "Privado/México", el bloque de chips de tipo de hospital queda obsoleto:
- Línea ~360: borrar el `.map(chip => ...)` completo (ya no hay selector de tipo).
- Línea ~390: reemplazar el chip del filtro activo por una etiqueta estática "Privado · México" o eliminarlo.

### 1.2 Header — orden y dropdown "Más"
En `src/components/layout/` (Header):
- Items principales visibles: **Live · Contenido Premium · Medical Masters · Educación · Chat · Disponibilidad**.
- Dropdown **"Más"** (shadcn `DropdownMenu`) con: Hospitales, Directorio, Doble Check, Recetas, Vault, Noticias, Suministros, Reuniones.
- Mobile: drawer reordenado con la misma jerarquía.

### 1.3 `/profile` — Sección de credenciales
En `DoctorProfile.tsx` añadir card **"Credenciales profesionales"** que lea/edite los nuevos campos del migration ya aplicado:
- `university` (input)
- `secondary_specialties` (multi-select usando `specialties.ts`)
- `workplaces` (lista editable: nombre + ciudad + tipo Hospital/Clínica)
- `cedula_especialidad` + estado de validación (badge: pending/approved/rejected con motivo)
- Botón "Validar cédula de especialidad" → reusa edge function existente de validación SEP cambiando endpoint a "especialidad".

### 1.4 `/doctor/vault` — Modal "Agregar paciente"
En `DoctorVault.tsx`:
- Botón "Agregar paciente" abre `Dialog` con tabs:
  - **Tab 1 — Buscar registrado**: input que llama RPC `search_patients_for_doctor` (ya existe).
  - **Tab 2 — Crear externo**: form (nombre, edad, sexo, teléfono, email, notas) → INSERT en `external_patients` (tabla ya creada).
- Validación con zod (nombre min 2, email opcional válido, teléfono opcional E.164).
- Lista de pacientes muestra mezcla de registrados + externos con badge diferenciador.

### 1.5 `/lives` — Gating visitante + tab "Programar"
**Gating** (`LivePlayer.tsx`):
- Detectar visitante anónimo → permitir 60s de preview, luego overlay bloqueante con CTA **"Crear cuenta gratis para seguir viendo"** → redirect a `/login?mode=signup&redirect=/lives/{id}`.
- Counter usando `useEffect` + cleanup; reproducir/pausar via Daily.co API.

**Tab Programar** (`DoctorGoLive.tsx`):
- Añadir `Tabs` con: "Empezar ahora" | "Programar curso".
- Tab Programar: form (título, descripción, fecha+hora, precio, categoría) → INSERT live con `status='scheduled'` y `scheduled_at` (columna ya existe).
- Mostrar lista de lives programados del doctor con acciones (editar/cancelar/iniciar).

### 1.6 Widget "Mis notas" en `DoctorDashboard`
- Card con últimas 5 entradas de `doctor_notes` (tabla ya creada).
- Quick-add inline (textarea + botón guardar).
- Link "Ver todas" → futura `/doctor/notes` (placeholder o expandible inline).

---

## Parte 2 — Auditoría de Seguridad (pre-pruebas del cliente)

### 2.1 Acciones automatizadas
1. Ejecutar `supabase--linter` → resolver TODO error/warning (RLS faltante, funciones sin `search_path`, índices, etc.).
2. Ejecutar `security--run_security_scan` → review completo de findings.
3. Revisar todas las tablas creadas en últimos 7 días (`external_patients`, `doctor_notes`) para confirmar RLS estricta.

### 2.2 Checklist manual de hardening

**Auth & Sesiones**
- Confirmar `password_hibp_enabled = true` (leaked password protection).
- Confirmar OTP expiry ≤ 10 min.
- Verificar que `handle_new_user` bloquea self-signup como `admin` (ya validado en trigger).
- Confirmar `Browser Re-login` (sessionStorage flag) sigue activo en `main.tsx`.

**RLS y datos sensibles**
- `external_patients`: solo el doctor creador puede SELECT/UPDATE/DELETE.
- `doctor_notes`: solo el dueño.
- `vault_files` + `vault_access`: confirmar política basada en `user_has_vault_access`.
- `prescriptions`: confirmar restricción por país (mem://constraints/prescription-country-restriction).
- `consultations`, `chat_sessions`, `messages`: solo participantes.
- `wallet_transactions`: bloquear INSERT directo desde cliente (solo via RPC `SECURITY DEFINER`).
- `doctor_profiles.pending_earnings/total_earnings`: bloquear UPDATE directo del cliente.
- `user_roles`: ningún UPDATE/INSERT desde cliente (solo admin via service role).

**Edge Functions**
- Verificar firma HMAC en: `stripe-webhook`, `daily-webhook`, `cloudflare-webhook`, `veriff-webhook`.
- Confirmar `verify_jwt = false` SOLO en webhooks públicos.
- Validar input con zod en endpoints que reciben body.
- Rate limiting: confirmar SMS Vonage (1/día onboarding, 2/día OTP).

**Storage**
- `vault-files`, `prescriptions`, `identity-documents`, `doctor-credentials`, `medical-history`, `doctor-invoices`, `report-attachments`, `recordings`, `documents`: privados con RLS por `(storage.foldername(name))[1] = auth.uid()::text` o equivalente.
- `doctor-content`: granular por `is_public` + suscripción/compra.
- Verificar buckets públicos solo contienen assets no-sensibles (`avatars`, `thumbnails`, `email-assets`, `ad-creatives`).

**Frontend hardening**
- Confirmar protección de PDFs/videos: blob URLs, `#toolbar=0`, contextmenu deshabilitado, `nodownload` (mem://features/content-protection-policy).
- Confirmar overlay anti-screenshot en contenido premium (si aplica).
- CSP/headers: revisar si hay headers configurables.

**Privacidad y reglas de negocio**
- Bloqueo paciente↔residente (mem://architecture/access-control-and-paywalls).
- Marketplace bloqueado para pacientes.
- Residentes no pueden cobrar consultas.
- OTP vault requiere consulta activa o historial de chat.

### 2.3 Entregable
Reporte final en chat con:
- Lista de hallazgos del linter/scanner + estado (fixed/accepted).
- Tabla de RLS por tabla sensible.
- Confirmación de webhooks firmados.
- Cualquier hallazgo crítico → fix inmediato vía migration.

---

## Orden de ejecución
1. Fix build error (1.1) — desbloquea preview.
2. Auditoría de seguridad (2.1, 2.2) — prioridad porque el cliente prueba HOY.
3. Header (1.2).
4. Profile credenciales (1.3).
5. Vault add patient (1.4).
6. Lives gating + scheduling (1.5).
7. Dashboard notes widget (1.6).

¿Apruebas para implementar en este orden?
