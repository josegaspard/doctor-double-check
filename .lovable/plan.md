

# Plan: Cerrar TODO al 100% — credenciales, auditoría, exports y confirmaciones

## Estado verificado

- **BD**: los 26 doctores ya tienen `cedula_profesional`, `cofepris_permit`, `cedula_status='approved'` y `cofepris_status='approved'`. Ninguno está sin credencial.
- **`LivesContext`** ya hace `select` de credenciales con `status` desde `doctor_profiles_public` y los mapea al objeto `Live` (líneas 158, 196-201).
- **`DoctorProfileCard`** ya integra `<CredentialStatusBadge>` para cédula y COFEPRIS (líneas 152-169).
- **`MedicalCredentialsReview`**: razón ya es obligatoria para ambas acciones (línea 374).
- **`VaultAuditPanel`** ya tiene filtros (archivo/acción/fecha), paginación 100 en 100, contador "N de M", Realtime y query separada de count.
- **`AccessDenied`** ya registra `access_denied` cuando llega con `?file_id=&patient_id=`.
- **`MedicalCredentialsReview`**: ya envía `data: { admin_notes }` y el `message` ya incluye `reason.trim()` en el body (líneas 137-141).

## Lo que falta implementar (este pase)

### 1. `DoctorProfileCard` — loading + error en credenciales

- Agregar `loading` y `loadError` al estado.
- Mientras carga, mostrar 2 `<Skeleton>` chiquitos en la fila de badges en lugar de quedar en blanco.
- Si falla, mostrar un `Badge` rojo "No se pudieron cargar credenciales" con tooltip del error y botón pequeño "Reintentar" que vuelve a llamar `loadCreds`.

### 2. `VaultAuditPanel` — exportar a CSV con filtros aplicados

- Botón nuevo "Exportar CSV" en el header (al lado de "Actualizar").
- Al click: re-query el dataset filtrado COMPLETO (no solo lo cargado) con `range(0, 4999)` como tope de seguridad.
- Resolver actores y archivos faltantes en lote (mismo patrón que `fetchAudit`).
- Generar CSV con columnas: `Fecha, Acción, Archivo, Actor (nombre), Patient ID, Metadata`.
- Escapar comillas y comas, descargar como `vault-audit-{mode}-{YYYYMMDD}.csv` usando `Blob` + `URL.createObjectURL`.
- Toast de éxito con número de filas exportadas.

### 3. `MedicalCredentialsReview` — confirmación extra antes de Aprobar/Rechazar

- Agregar paso de confirmación dentro del mismo `<Dialog>`:
  - Estado local `confirmStep: 'edit' | 'confirm'`.
  - El primer click en "Aprobar"/"Rechazar" cambia a `confirm` y muestra:
    - Resumen visual: nombre doctor, tipo credencial, acción, número/permiso, primeras 100 chars de la nota.
    - Texto de advertencia: "Esta acción notificará al doctor inmediatamente y queda registrada en auditoría. ¿Confirmas?".
    - Botones: "Volver a editar" / "Sí, confirmar y enviar".
- Solo el segundo click ejecuta `handleAction`.
- Al cerrar el dialog se resetea a `edit`.

### 4. Notificación al doctor — incluir notas en cuerpo VISIBLE

Estado actual ya incluye `reason.trim()` en `message`, pero el formato es plano. Lo mejoro:

- Construir el `message` con saltos de línea y prefijo claro:
  - **Aprobar**: `"Tu Cédula Profesional fue aprobada por el equipo de Medical Masters.\n\n📝 Notas de verificación:\n{reason}"`
  - **Rechazar**: `"Tu Permiso COFEPRIS no fue aprobado.\n\n❌ Motivo:\n{reason}\n\nPuedes corregir y volver a enviar la documentación desde tu perfil."`
- Mantener `data.admin_notes` para acceso programático.
- Tipo de notificación según acción: `'system'` para aprobar, `'system'` para rechazar (mantenemos system; el título emoji ya distingue).

## Archivos tocados

1. `src/components/doctor/DoctorProfileCard.tsx` — loading/error states + Skeletons + Reintentar.
2. `src/components/vault/VaultAuditPanel.tsx` — botón "Exportar CSV" + helper de export con filtros activos.
3. `src/components/admin/MedicalCredentialsReview.tsx` — confirmStep en dialog + mensaje multilínea con notas visibles.

**Sin migraciones SQL** — todo está en BD ya:
- Los 26 doctores tienen credenciales pobladas y aprobadas (verificado con query directa).
- View `doctor_profiles_public` expone `cedula_profesional`, `cofepris_permit`, `cedula_status`, `cofepris_status` y razones.
- Tabla `vault_audit_log` con triggers y RPC `log_vault_action` operativos.
- Realtime ya activo en `vault_audit_log` desde el panel.

## Resultado garantizado

- En `/lives`, las cards ya muestran cédula + COFEPRIS de los 26 doctores con su badge de estado (verde aprobado, los actuales). Confirmado por consulta a BD.
- El doctor logueado ve un loader mientras cargan sus credenciales y un mensaje de error con botón "Reintentar" si falla.
- El admin puede exportar todos los eventos del Vault auditados (con filtros aplicados) a CSV con un solo click.
- El admin no puede aprobar/rechazar credenciales por accidente: hay un paso de confirmación con resumen visual.
- El doctor recibe una notificación con las notas de verificación claramente visibles en el cuerpo del mensaje, no solo en metadata.

