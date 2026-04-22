

# Plan: Cierre de chat gate, Vault simulator, y suite e2e completa de validación

## 1. Compuerta de chat completa (Paywall + input deshabilitado)

**`src/components/chat/ChatMessagesPanel.tsx`** — ya tiene `hasChatEntitlement` calculado pero falta el bloqueo de UI:

- Importar `<PaywallModal>` y agregar estado `paywallOpen`.
- Cuando `!hasChatEntitlement && entitlementChecked && userRole === 'patient'`:
  - Renderizar banner sobre el input: "Necesitas una consulta activa para enviar mensajes" + botón "Comprar consulta ($X)".
  - `<Input disabled placeholder="Compra una consulta para enviar mensajes" />`.
  - `<Button disabled>` en Send.
  - Click en banner abre `<PaywallModal mode="consultation" doctorId={...} fee={consultationFee} />`.
- Tras compra exitosa (callback `onSuccess`): refetch de entitlement, cerrar modal.
- Interceptar `onSend()`: si no hay entitlement, abrir paywall en lugar de enviar.

Obtener `consultationFee` consultando `doctor_profiles.consultation_fee` del otro participante en el mismo `useEffect` que ya consulta entitlements.

## 2. VaultUploadSimulator integrado en Vault.tsx

**`src/pages/Vault.tsx`** — reemplazar el `<input type="file">` o botón de subida actual por `<VaultUploadSimulator onUploaded={refetch} />` dentro de un Dialog disparado por el botón "Subir archivo".

Pasar callback `onUploaded` que refresque la lista de archivos del paciente (`fetchVaultFiles()`).

## 3-11. Suite de tests e2e completa

Crear los siguientes archivos en `src/test/e2e/`:

### `chat-gate.test.tsx`
- Mock auth como `patient` sin entitlement → chat con doctor → verifica:
  - Banner "Comprar consulta" visible
  - Input deshabilitado con placeholder correcto
  - `<PaywallModal>` aparece al click
  - Tras simular compra exitosa: input habilitado

### `chat-previews.test.tsx`
- Renderiza `<ChatSessionItem>` con varios `last_message`:
  - `📷 [Imagen: scan.jpg]` → debe renderizar `📷 Foto`
  - `📎 [Archivo: estudio.pdf]` → `📎 estudio.pdf`
  - `🎥 [Video: live.mp4]` → `🎥 Video`
  - `📋 https://app/prescriptions/abc` → `📋 Receta médica`
- Verifica que NO aparece nunca el token raw `[Imagen:`, `[Archivo:`, `[Video:`.
- Renderiza `<NotificationBell>` con notification de `chat_message`: mismo set de assertions.
- Verifica longitud máxima (60 chars en lista, 120 en notification body).

### `credential-popover.test.tsx`
- Mock doctor con `cedula_status='pending'` → click en badge → popover con texto "Pendiente de revisión".
- Mock con `status='approved'` → popover con "Verificada por Medical Masters".
- Mock con `status='rejected'` y `rejection_reason='Documento ilegible'` → popover muestra razón + botón "Subir nuevo documento" (solo cuando `isOwner`).

### `credential-resubmit.test.tsx`
- Mock auth como doctor logueado con `cedula_status='rejected'`, `rejection_reason='Foto borrosa'`.
- Renderiza `<DoctorCredentials />` → verifica `<Alert variant="destructive">` con la razón completa.
- Simula click en "Subir nuevo documento" → file input → simula selección de PDF válido → mock de upload exitoso a `doctor-credentials` bucket.
- Verifica que tras subida se llama a `update({ cedula_status: 'pending', cedula_rejection_reason: null })`.
- Verifica que la UI ahora muestra estado `pending` y desaparece el alert.

### `recording-url-expiration.test.tsx`
- Mock signed URL con `urlGeneratedAt = Date.now() - 56*60*1000` (56 min).
- Renderiza `<RecordingPlayer>` → simula `<video onError>` → verifica overlay "Sesión expirada" + botón "Renovar sesión".
- Click en renovar → mock nueva signed URL → verifica que el video carga con el nuevo src.
- Test adicional: usuario sin compra → verifica que `<RecordingPaywall>` aparece en lugar del video.

### `recording-paywall-flow.test.tsx`
- Mock auth como doctor sin compra de grabación de otro doctor.
- Verifica que `<RecordingPaywall>` se muestra con estado wallet `idle`.
- Click "Pagar con Wallet" → mock RPC success → verifica transición `initiated` → `paid` → player aparece sin reload.
- Mock realtime INSERT en `purchases` → verifica que `setHasPurchased(true)` se dispara y player aparece.

### `vault-audit-access.test.tsx`
- Mock auth como `patient1` con archivos propios → mock query `vault_audit_log` filtrada por `patient_id=patient1`.
- Verifica que solo eventos de archivos del paciente aparecen.
- Mock auth como `doctor1` con acceso a 1 archivo de `patient1` → mock query con filtro `actor_id=doctor1 OR file_id IN (allowed)`.
- Verifica que doctor solo ve eventos donde fue el actor o sobre archivos a los que tiene acceso.
- Mock filtros: rango de fecha, archivo específico, tipo de acción → verifica que la tabla se filtra correctamente.

### `vault-audit-realtime.test.tsx`
- Renderiza `<VaultAuditPanel mode="patient" />` con lista inicial vacía.
- Simula INSERT realtime en `vault_audit_log` con `action='access_granted'` → verifica que aparece en la tabla sin recargar.
- Simula INSERT con `action='access_revoked'` → aparece con badge ámbar.
- Simula INSERT con `action='viewed'` → aparece con badge azul.
- Simula INSERT con `action='uploaded'` → aparece con badge gris.
- Click "Exportar CSV" → mock `URL.createObjectURL` → verifica que el blob contiene exactamente los eventos visibles tras aplicar filtros (no todos).

### `recording-direct-url.test.tsx`
- Simula URL pública directa: `/recording/:id` con query `?signed_url=expired_token`.
- Mock backend devuelve 403 al fetch → verifica overlay de bloqueo.
- Verifica que el `<video>` no recibe `src` con el token expirado.
- Adicional: verifica que `RecordingPaywall` se renderiza si el usuario nunca compró, aun si llega con URL directa.

### `vault-audit-csv.test.tsx`
- Renderiza panel con 10 eventos, aplica filtro de fecha = "Hoy" → solo 3 visibles.
- Click "Exportar CSV" → captura el blob → parsea contenido → verifica exactamente 3 filas + header.
- Verifica columnas: `fecha,accion,archivo,actor,doctor`.
- Verifica que cada fila tiene escape correcto de comillas (CSV-safe).

## Helpers compartidos

**Extender `src/test/e2e/helpers.tsx`** con:
- `mockSupabaseQuery(table, response)` — interceptor genérico para `from().select().eq().maybeSingle()`.
- `mockRealtimeChannel(table, events[])` — emite eventos `postgres_changes` simulados.
- `mockUpload(bucket, success)` — simula upload con `onprogress` callbacks.
- `mockSignedUrl(path, expiresIn)` — devuelve URL falsa con TTL controlado.

## Archivos tocados

**Editados:**
1. `src/components/chat/ChatMessagesPanel.tsx` — paywall + input disabled cuando `!hasChatEntitlement`
2. `src/pages/Vault.tsx` — integrar `<VaultUploadSimulator>`
3. `src/test/e2e/helpers.tsx` — helpers de mock para Supabase queries/realtime/upload/signed URLs

**Nuevos tests:**
4. `src/test/e2e/chat-gate.test.tsx`
5. `src/test/e2e/chat-previews.test.tsx`
6. `src/test/e2e/credential-popover.test.tsx`
7. `src/test/e2e/credential-resubmit.test.tsx`
8. `src/test/e2e/recording-url-expiration.test.tsx`
9. `src/test/e2e/recording-paywall-flow.test.tsx`
10. `src/test/e2e/vault-audit-access.test.tsx`
11. `src/test/e2e/vault-audit-realtime.test.tsx`
12. `src/test/e2e/recording-direct-url.test.tsx`
13. `src/test/e2e/vault-audit-csv.test.tsx`

## Resultado garantizado

- Pacientes sin entitlement no pueden enviar mensajes; ven banner + paywall y, tras pagar, el chat se desbloquea sin recarga.
- Subida al Vault siempre pasa por el simulator con progreso real, validación MIME y confirmación explícita de permisos por doctor.
- Suite e2e cubre los 9 flujos solicitados: chat gate, previews limpios, popover de credenciales con sus 3 estados, resubida del doctor, expiración de URL del player, paywall de grabaciones, auditoría con permisos correctos, realtime + CSV de auditoría, y bloqueo de URL directa expirada.
- Cualquier regresión futura en estos flujos rompe CI inmediatamente.

