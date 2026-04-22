

# Plan: Cerrar al 100% items 4 y 5 (verificación con estados + auditoría con filtros)

Los items 1, 2, 3 ya están implementados correctamente (verificado en código). Este plan completa lo que aún falta de los items 4 y 5.

## Item 4 — UI de verificación pending/approved/rejected en TODA la app

La base de datos y el componente `CredentialStatusBadge` ya existen. Falta **propagar el estado** desde la BD hasta los lugares donde se muestran las credenciales (hoy aún se renderiza el badge plano sin estado).

**4.1. Tipos**
- `src/types/index.ts` (o donde esté `Live`): agregar `doctorCedulaStatus`, `doctorCedulaRejectionReason`, `doctorCofeprisStatus`, `doctorCofeprisRejectionReason`.
- `src/pages/ContentGallery.tsx` interface `ContentItem`: campos análogos `creator_cedula_status` / `_rejection_reason` para cédula y COFEPRIS.

**4.2. Fetch en contextos**
- `src/contexts/LivesContext.tsx` (línea ~146): ampliar el `select` de `doctor_profiles_public` a `cedula_status, cedula_rejection_reason, cofepris_status, cofepris_rejection_reason`. Guardar en `doctorProfileCache` y mapear a los nuevos campos del objeto Live.
- `src/pages/ContentGallery.tsx` (línea ~310-330): mismo `select` ampliado, mapear al objeto `ContentItem`.

**4.3. Sustituir badges crudos por `CredentialStatusBadge`**
Reemplazar los `<Badge>` planos en estos 4 lugares:
- `src/pages/LivePlayer.tsx` líneas 642-648 (las dos líneas `Céd. Prof.:` y `COFEPRIS:`).
- `src/pages/LivesGrid.tsx` líneas 110-126.
- `src/pages/ContentGallery.tsx` líneas 231-253.
- `src/components/content/ContentPreviewModal.tsx` líneas 316+.

Cada uno renderiza dos `<CredentialStatusBadge type="cedula" status={...} value={...} rejectionReason={...} />` que ya muestran color (verde/amarillo/rojo) + popover explicativo (incluida razón de rechazo de COFEPRIS).

**4.4. Admin: aprobar/rechazar cédula y COFEPRIS por separado**
`src/pages/AdminVerifications.tsx`: añadir una **segunda pestaña "Credenciales médicas"** dentro del tabs existente que liste doctores con `cedula_status` o `cofepris_status` en `pending`. Para cada uno, dos secciones (Cédula / COFEPRIS) con botones Aprobar / Rechazar. Al rechazar abrir el dialog actual y guardar:
```ts
await supabase.from('doctor_profiles').update({
  cedula_status: 'rejected',          // o 'approved'
  cedula_rejection_reason: reason,    // solo en rechazo
}).eq('user_id', doctorId);
```
Análogo para COFEPRIS. La tab existente "Verificaciones de Identidad" sigue manejando `identity_verifications` (Veriff) sin cambios.

## Item 5 — Auditoría Vault con filtros por fecha y archivo

`VaultAuditPanel` ya existe pero sin filtros. Lo extiendo:

**5.1. Filtros UI** (en `src/components/vault/VaultAuditPanel.tsx`)
- Fila de controles encima de la lista:
  - **Selector de archivo**: `<Select>` poblado con los archivos únicos del set actual + opción "Todos".
  - **Selector de acción**: "Todas / Acceso / Permiso otorgado / Permiso revocado / Denegado / OTP".
  - **Rango de fecha**: dos inputs `type="date"` (desde / hasta). Default: últimos 30 días.
  - Botón "Limpiar filtros".

**5.2. Lógica**
- Cambiar fetch a aceptar params; aplicar `gte('created_at', from)`, `lte('created_at', to)`, `eq('file_id', fileId)` y `in('action', actions)` cuando estén definidos.
- Mantener límite de 100 con paginación simple "Cargar más" (incrementa límite +100).
- Mostrar contador "Mostrando N de M eventos" debajo de los filtros.

**5.3. Registrar acceso real al firmar URL**
Hoy el trigger registra `access_granted` / `access_revoked` automáticamente. Falta `accessed` y `access_denied`. En `src/contexts/VaultContext.tsx` (donde se solicita la URL firmada del archivo), tras éxito llamar:
```ts
await supabase.rpc('log_vault_action', {
  p_file_id: fileId,
  p_patient_id: patientId,
  p_action: 'accessed',
  p_metadata: { source: 'vault_preview' }
});
```
Y en el catch del error 403, registrar `access_denied`.

## Archivos tocados

**Frontend**:
1. `src/contexts/LivesContext.tsx` — ampliar select y mapping de credenciales con status.
2. `src/pages/LivePlayer.tsx` — reemplazar líneas 642-648 por `CredentialStatusBadge`.
3. `src/pages/LivesGrid.tsx` — reemplazar líneas 110-126 por `CredentialStatusBadge`.
4. `src/pages/ContentGallery.tsx` — ampliar interface, fetch y reemplazar líneas 231-253.
5. `src/components/content/ContentPreviewModal.tsx` — reemplazar bloque líneas 316+.
6. `src/pages/AdminVerifications.tsx` — añadir tab "Credenciales médicas" con aprobar/rechazar Cédula y COFEPRIS por separado.
7. `src/components/vault/VaultAuditPanel.tsx` — agregar filtros (archivo, acción, fecha) + paginación.
8. `src/contexts/VaultContext.tsx` — llamar `log_vault_action` en accesos y denegaciones.

**Sin migraciones nuevas** — la BD ya tiene todo lo necesario (enum, columnas, view, tabla, triggers, RPC).

## Resultado garantizado

- Card de doctor en Lives, LivesGrid, ContentGallery y ContentPreviewModal muestran badge de Cédula y COFEPRIS con color por estado (verde aprobado / amarillo pendiente / rojo rechazado) y popover con razón cuando aplica.
- Admin puede aprobar o rechazar Cédula y COFEPRIS de cada doctor por separado, dejando razón documentada que se muestra al doctor y a usuarios que vean su card.
- Panel de auditoría del Vault filtrable por archivo, tipo de acción y rango de fecha, tanto para paciente (su expediente) como para doctor (sus accesos), con paginación.
- Cada apertura/preview de archivo del Vault queda registrada como `accessed`; los rechazos de RLS quedan como `access_denied`.

