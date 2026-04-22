

# Plan: Cerrar al 100% los 3 puntos pendientes

Ya verifiqué el estado real del código. Todo lo demás está implementado. Aquí cierro los huecos exactos que faltan:

## 1. `CredentialStatusBadge` en `DoctorProfileCard` (único faltante de "badges sueltos")

`LivesGrid.tsx`, `ContentGallery.tsx` y `ContentPreviewModal.tsx` ya usan `CredentialStatusBadge`. **Sólo falta en `DoctorProfileCard.tsx`** (dashboard del propio doctor), donde hoy únicamente se muestra el badge de estado general (`Aprobado / Pendiente`) sin sus credenciales.

**Cambios en `src/components/doctor/DoctorProfileCard.tsx`:**
- Cargar de `doctor_profiles` (RLS permite al dueño): `cedula_profesional, cedula_status, cedula_rejection_reason, cofepris_permit, cofepris_status, cofepris_rejection_reason` con un `useEffect` único.
- Debajo del nombre/especialidad agregar una fila `flex flex-wrap gap-1` con dos `<CredentialStatusBadge type="cedula"|"cofepris" ... />`.
- Si la credencial está `rejected`, el popover ya muestra el motivo (lógica del componente). El doctor verá su propia razón de rechazo aquí mismo → mejora UX para que sepa por qué fue rechazada y pueda actuar.

## 2. AdminVerifications: razón **obligatoria también al aprobar** (no solo al rechazar)

Hoy `MedicalCredentialsReview.tsx` permite aprobar sin escribir nada (línea 360: `disabled={isProcessing || (actionDialog.action === 'reject' && !reason.trim())}`). Tu petición textual: *"campo de razón obligatorio para cada acción"*.

**Cambios en `src/components/admin/MedicalCredentialsReview.tsx`:**
- Mostrar el `<Textarea>` también cuando `action === 'approve'` con label "Notas de aprobación" (placeholder: "Confirma cómo verificaste esta credencial — visible al doctor y registrado para auditoría").
- Cambiar `disabled` a: `isProcessing || !reason.trim()` para AMBAS acciones.
- Persistir la nota:
  - En `approve`: guardar la nota en `cedula_rejection_reason` / `cofepris_rejection_reason` **NO** (ese campo es semánticamente para rechazo). En su lugar, persistirla en el `metadata` de la notificación al doctor + incluirla en el body del mensaje de notificación que ya se inserta en `notifications`.
  - En `reject`: comportamiento actual (campo de motivo requerido) sigue igual.
- Renombrar dinámicamente el label del Textarea según acción ("Motivo del rechazo" vs "Notas de verificación").
- Renombrar título del dialog: "Aprobar credencial — confirma verificación" / "Rechazar credencial — indica motivo".

## 3. Verificación end-to-end del panel de auditoría Vault (filtros, paginación, eventos)

El `VaultAuditPanel.tsx` ya tiene filtros (archivo, acción, fecha desde/hasta), contador `Mostrando N de M`, botón "Cargar más" en bloques de 100 y "Limpiar filtros". Está conectado a `vault_audit_log` con triggers automáticos para `access_granted`/`access_revoked` y al `log_vault_action` desde `VaultFilePreviewModal` para `accessed`/`access_denied`.

**Lo que cierro en este pase para garantizar que funciona end-to-end:**

a) **Bug en `count` cuando hay filtros**: hoy se hace `select('*', { count: 'exact' }).limit(limit)` — Supabase devuelve `count` del total **sin** aplicar el limit (correcto), pero al combinar con `.in()` o múltiples `.eq()` con `count: 'exact'` puede ser lento. Cambio a `count: 'exact', head: false` (ya lo es) y agrego `useEffect` separado que sólo recalcula `totalCount` cuando cambian los filtros, no cuando cambia `limit` (hoy refetchea todo al cargar más → desperdicio). Optimización: `limit` no debe disparar `count` — separo el query en dos.

b) **Realtime opcional**: agregar suscripción a `postgres_changes` sobre `vault_audit_log` filtrada por `patient_id` o `actor_id` para refrescar la lista automáticamente cuando llegan eventos nuevos sin tener que pulsar "Actualizar".

c) **Logging de `access_denied` para descargas bloqueadas por DRM/rol** desde `/access-denied` (cuando un usuario llega ahí desde un intento de Vault): registrar el evento si trae `?file_id=` en la URL.

d) **Helper `useVaultAuditLogger`** (nuevo, opcional) que centraliza llamadas a `log_vault_action` para reutilizar desde otros sitios futuros sin duplicar código.

e) **Test manual documentado** (en código como comentario): pasos para validar que (i) subo un archivo → triggers `access_granted` cuando comparto con un doctor; (ii) doctor abre preview → `accessed`; (iii) revoco acceso → `access_revoked`; (iv) doctor intenta abrir tras revocación → `access_denied`. Los 4 eventos deben aparecer en el panel del paciente con filtros funcionando.

## Archivos tocados

1. `src/components/doctor/DoctorProfileCard.tsx` — fetch de credenciales + 2 `<CredentialStatusBadge>`.
2. `src/components/admin/MedicalCredentialsReview.tsx` — textarea visible y obligatorio para `approve` y `reject`; texto del dialog dinámico; nota incluida en notificación al doctor.
3. `src/components/vault/VaultAuditPanel.tsx` — separar query de count del query de data, suscripción Realtime opcional para refresco automático, manejar `access_denied` desde `/access-denied`.
4. `src/pages/AccessDenied.tsx` — leer `?file_id=` y `?patient_id=` y llamar `log_vault_action` con `access_denied` si están presentes.

**Sin migraciones SQL** — la BD ya tiene todo (enum, columnas, view, tabla `vault_audit_log`, triggers, RPC `log_vault_action`, política RLS).

## Resultado garantizado

- **Doctor logueado** ve sus propias credenciales con estado y motivo de rechazo en su dashboard (`DoctorProfileCard`).
- **Admin** está obligado a documentar TODA acción (aprobar o rechazar) con texto que se notifica al doctor y queda registrado.
- **Panel Vault** muestra contador correcto incluso al paginar, refresca en tiempo real cuando hay eventos nuevos, y registra `access_denied` también cuando un usuario llega a `/access-denied` desde un intento de Vault.
- Cobertura completa de los 4 estados: `accessed`, `access_granted`, `access_revoked`, `access_denied` filtrables por archivo, acción y fecha, con paginación 100 en 100.

