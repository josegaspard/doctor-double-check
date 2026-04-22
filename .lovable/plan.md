

# Plan: Cierre final — CSV con encoding validado, bloqueo total de chat sin entitlement, Vault zero-metadata, watermark DRM por sesión

## 1. Exportación CSV mejorada con encoding validado

**`src/components/vault/VaultAuditPanel.tsx`**:
- Agregar estado `visibleColumns` (default: todas) — los filtros de columna ya activos en UI determinan qué columnas exportar.
- Refactor `exportCSV()`:
  - Construir headers solo desde `visibleColumns` (orden fijo: `Fecha → Acción → Archivo → Actor → Patient ID → Metadata`).
  - Validar encoding antes del download: usar `new TextEncoder('utf-8').encode(csv)` y verificar `bytes[0..2] === [0xEF, 0xBB, 0xBF]` (BOM UTF-8). Si falla, lanzar error visible con `toast.error("Error de encoding al exportar")`.
  - Mime estricto: `text/csv;charset=utf-8;`.
  - Nombre del archivo incluye filtros activos: `auditoria_${YYYY-MM-DD}_${actionFilter || 'todos'}.csv`.

**Extender `src/test/e2e/vault-audit-csv.test.tsx`**:
- Test con solo 3 columnas visibles → CSV header tiene exactamente 3 columnas en el orden correcto.
- Test que valida los primeros 3 bytes del Blob (BOM `EF BB BF`).
- Test que verifica `Blob.type === 'text/csv;charset=utf-8;'`.
- Test que el nombre del archivo refleja los filtros (`auditoria_2026-04-22_access_granted.csv`).

## 2. Bloqueo total de chat con Enter/atajos + PaywallModal

**`src/components/chat/ChatMessagesPanel.tsx`** — actualmente ya hay `handleSendIntercept`, falta cubrir keybindings:
- En el `<Textarea>` (o `<Input>`) del chat, agregar `onKeyDown`:
  ```ts
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendIntercept(); // dispara paywall si no hay entitlement
    }
  };
  ```
- Cuando `!hasChatEntitlement && entitlementChecked && userRole === 'patient'`:
  - `<Textarea disabled placeholder="Compra una consulta para enviar mensajes" aria-disabled="true">`.
  - Cualquier paste, drag&drop, o atajo (Ctrl+V) bloqueado vía `onPaste={(e) => { e.preventDefault(); openPaywall(); }}`.
  - Botón de adjunto y emojis con `disabled={!hasChatEntitlement}`.
- Tras cerrar PaywallModal: restaurar focus al textarea con `inputRef.current?.focus()`.

**`src/test/e2e/chat-keyboard-block.test.tsx`** — extender:
- Verifica `e.preventDefault()` se llamó cuando Enter sin entitlement.
- Verifica que `Ctrl+Enter` también dispara paywall (no envía).
- Verifica que `onPaste` con texto largo dispara paywall y NO inserta el texto en el textarea.
- Verifica que el botón de adjunto está `disabled` y al hacer click abre paywall.
- Verifica que tras `paywall.close()` el `document.activeElement === textareaRef`.

## 3. Vault zero-metadata cuando se revoca acceso

**`src/components/vault/VaultFilePreviewModal.tsx`** y `useVaultFiles` hook (si existe):
- Modificar el query de archivos para el doctor: en lugar de `select('*').eq('patient_id', X)`, usar JOIN con `vault_access`:
  ```sql
  SELECT vf.* FROM vault_files vf
  INNER JOIN vault_access va ON va.file_id = vf.id
  WHERE va.doctor_id = auth.uid()
    AND (va.expires_at IS NULL OR va.expires_at > now())
  ```
  Esto se traduce en TS usando `.in('id', allowedFileIds)` precalculado por una RPC `get_doctor_accessible_files()`.

**Nueva migración SQL**:
- Función `get_doctor_accessible_files()` SECURITY DEFINER que devuelve solo archivos con `vault_access` activo para el doctor llamante.
- Política RLS estricta en `vault_files`:
  ```sql
  CREATE POLICY "Doctors only see files with active access"
  ON vault_files FOR SELECT
  USING (
    auth.uid() = patient_id  -- patients always see own files
    OR EXISTS (
      SELECT 1 FROM vault_access va
      WHERE va.file_id = vault_files.id
        AND va.doctor_id = auth.uid()
        AND (va.expires_at IS NULL OR va.expires_at > now())
    )
  );
  ```
  Reemplaza la política existente que pueda exponer metadata.
- Trigger en DELETE de `vault_access`: registra `access_revoked` en `vault_audit_log` (ya existe vía `trg_vault_access_audit`).

**Nuevo test `src/test/e2e/vault-revoke-zero-metadata.test.tsx`**:
- Mock doctor con acceso a archivo X → ve `file_name`, `mime_type`, `created_at`.
- Mock revocación: `vault_access` row eliminado → re-query → archivo X NO aparece en lista, ni siquiera el nombre.
- Verifica que un fetch directo a la URL del archivo retorna 403.
- Verifica que `vault_audit_log` registra `access_revoked` con `actor_id` correcto.

## 4. Watermark DRM dinámico por sesión + verificación

**`src/components/recordings/DynamicWatermark.tsx`** ya existe — reforzar:
- Recibir prop opcional `sessionId` (uuid corto del playback session) y mostrarlo además del email/userId.
- Formato visible: `<email_truncated> · <userId_short> · <session_id_short> · <hh:mm:ss>` con timestamp actualizado cada 30s vía `setInterval`.
- Posición rotativa cada 60s entre 4 esquinas (top-left, top-right, bottom-left, bottom-right) para evitar masking estático.
- `mix-blend-mode: difference` y `opacity-40` para visibilidad sobre cualquier fondo sin tapar contenido.

**Integrar en**:
- `src/components/recordings/RecordingVideoPlayer.tsx` — ya integrado, pasar `sessionId={crypto.randomUUID()}` generado al montar.
- `src/components/recordings/CloudflareRecordingPlayer.tsx` — mismo patrón.
- `src/components/recordings/RecordingChatReplay.tsx` — agregar watermark también si se renderiza video adjunto.
- `src/pages/LivePlayer.tsx` y `LiveStreamView.tsx` — agregar para lives en vivo (no solo grabaciones).

**Extender `src/test/e2e/recording-protection-renewal.test.tsx`**:
- Mount 2 instancias del player en el mismo test → verifica que cada una tiene un `sessionId` distinto.
- Verifica que el watermark contiene el `sessionId` truncado visible.
- Avanza `vi.useFakeTimers()` 30s → verifica que el timestamp cambió.
- Avanza 60s → verifica que la posición rotó (className diferente).
- Verifica `mix-blend-mode: difference` en computed style.
- Tras renovar URL firmada, verifica que el watermark sigue presente con el mismo `sessionId` (sesión de visualización persiste).

**Nuevo test `src/test/e2e/watermark-session-uniqueness.test.tsx`**:
- Renderiza player → captura `sessionId` mostrado.
- Desmonta + remonta → captura nuevo `sessionId` → verifica que es distinto.
- Renderiza 3 players simultáneos en distintas tabs simuladas → cada uno tiene sessionId único.

## Archivos tocados

**Nuevos:**
1. `src/test/e2e/vault-revoke-zero-metadata.test.tsx`
2. `src/test/e2e/watermark-session-uniqueness.test.tsx`

**Editados:**
3. `src/components/vault/VaultAuditPanel.tsx` — CSV con `visibleColumns` + validación de BOM/encoding antes del download
4. `src/components/chat/ChatMessagesPanel.tsx` — `onKeyDown` para Enter/Ctrl+Enter, `onPaste` bloqueado, refs para focus
5. `src/components/recordings/DynamicWatermark.tsx` — prop `sessionId`, display extendido
6. `src/components/recordings/RecordingVideoPlayer.tsx` — generar `sessionId` único al mount
7. `src/components/recordings/CloudflareRecordingPlayer.tsx` — mismo
8. `src/components/recordings/RecordingChatReplay.tsx` — integrar watermark
9. `src/pages/LivePlayer.tsx` — integrar watermark
10. `src/components/live/LiveStreamView.tsx` — integrar watermark
11. `src/test/e2e/vault-audit-csv.test.tsx` — extender con tests de columnas filtradas, BOM bytes, mime, nombre de archivo
12. `src/test/e2e/chat-keyboard-block.test.tsx` — extender con paste, Ctrl+Enter, focus restoration
13. `src/test/e2e/recording-protection-renewal.test.tsx` — extender con verificación de sessionId, rotación de posición, mix-blend
14. `src/pages/Vault.tsx` y `src/pages/DoctorVault.tsx` — usar nueva RPC `get_doctor_accessible_files`

**Migración SQL:**
15. Nueva función `get_doctor_accessible_files()` + política RLS estricta sobre `vault_files`

## Resultado garantizado

- CSV de auditoría exporta solo columnas visibles en orden fijo, con BOM validado byte-a-byte y nombre que refleja filtros aplicados.
- Chat sin entitlement bloquea Enter, Ctrl+Enter, paste, drag&drop, botones de adjunto; PaywallModal se abre en cualquier intento; foco vuelve al textarea tras cerrar.
- Doctor sin acceso vigente NO ve metadata del archivo (ni nombre, ni mime, ni fecha) — la lista se filtra en el backend vía RLS+RPC, no en el cliente.
- Watermark DRM muestra email + userId + sessionId único por sesión + timestamp actualizado cada 30s, rota posición cada 60s, persiste tras renovación de URL firmada, y aparece en grabaciones, replay de chat, lives en vivo y live player.
- Tests cubren todas las regresiones: CSV (encoding, columnas, mime), chat (keyboard, paste, focus), Vault (zero-metadata tras revoke), watermark (uniqueness por sesión, rotación, mix-blend).

