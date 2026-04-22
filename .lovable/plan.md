

# Plan: Live processing overlay, recording paywall hardening, CSV preview, watermark en hover, Wallet Ledger

## 1. Overlay "Procesando grabación" / "Listo para replay" para estados live

**Nuevo `src/components/live/LiveProcessingOverlay.tsx`**:
- Props: `status: 'live' | 'processing_recording' | 'recording_ready'`, `recordingId?: string`, `onReplayClick: () => void`.
- Estados visuales:
  - `live`: badge rojo pulsante "EN VIVO" con contador de viewers.
  - `processing_recording`: spinner + "Procesando grabación..." + barra de progreso indeterminada + texto "Esto puede tardar 1-3 minutos".
  - `recording_ready`: ícono check verde + "Replay disponible" + botón "Ver replay".
- Reintentos automáticos: `useEffect` con `setInterval(15s)` que re-consulta `lives` table por `recording_status`. Tras 5 reintentos sin cambio, muestra botón manual "Reintentar".
- Transición automática: cuando `status` cambia a `recording_ready`, mostrar toast + auto-redirect tras 3s a `/recordings/{recordingId}` (si el usuario no canceló).

**Editado `src/pages/LivePlayer.tsx` y `src/components/live/LiveEndedOverlay.tsx`**:
- Renderizar `<LiveProcessingOverlay>` cuando `live.status !== 'live'`.
- Suscribirse a Realtime channel sobre `lives` table filtrando por `id=live_id` para detectar cambios de `recording_status` sin polling adicional.

**Migración SQL** (si falta):
- Verificar columna `recording_status` en `lives` con enum `('none', 'processing', 'ready', 'failed')`. Si no existe, agregarla con default `'none'`.
- Trigger en `cloudflare-webhook` (edge function ya existe) que actualiza `recording_status` cuando Cloudflare confirma el VOD listo.

**Test e2e nuevo `src/test/e2e/live-recording-states.test.tsx`**:
- Mock `lives.recording_status='processing'` → verifica que aparece spinner y texto.
- Simula update Realtime a `'ready'` → verifica que aparece botón "Ver replay" y se dispara redirect tras 3s (con `vi.useFakeTimers`).
- Simula 5 reintentos sin cambio → botón "Reintentar" aparece, click → re-fetch con `expect(supabase.from).toHaveBeenCalledWith('lives')`.

## 2. Hardening de paywall en grabaciones premium

**Editado `src/components/recordings/RecordingVideoPlayer.tsx` y `CloudflareRecordingPlayer.tsx`**:
- Antes de renderizar `<video>` o solicitar URL firmada, verificar `hasPurchased(recordingId) || isOwner || isAdmin`.
- Si NO tiene acceso:
  - NO renderizar `<video>` (evita prefetch del navegador).
  - NO llamar a `supabase.functions.invoke('get-cloudflare-playback')` (evita gastar URL firmada).
  - Renderizar `<RecordingPaywall>` directamente.
- Eliminar botón "Descargar" del UI cuando no hay acceso (`{hasPurchased && <DownloadButton />}`).
- En `RecordingPaywall.tsx`, omitir el atributo `download` y el endpoint de download.

**Edge function `get-cloudflare-playback/index.ts`** — reforzar:
- Validar JWT del usuario.
- Query a `purchases` y `recordings.user_id` antes de generar URL firmada.
- Si no tiene acceso: retornar `403 { error: 'Forbidden: No purchase found' }`. NUNCA generar la URL.

**Editado `src/pages/RecordingPlayer.tsx`**:
- En el `useEffect` de carga, si `!hasPurchased && !isOwner`, NO disparar fetch de la URL — mostrar paywall directo.
- Si el usuario manipula el URL hash o pega `?direct=1`, ignorar y aplicar la misma validación.

**Test e2e nuevo `src/test/e2e/recording-direct-url.test.tsx`**:
- Sin compra: render `<RecordingPlayer>` con `recordingId='premium-X'` → `<video>` NO en DOM, `<RecordingPaywall>` visible.
- Verifica que `supabase.functions.invoke` NUNCA fue llamada con `'get-cloudflare-playback'`.
- Mock fetch directo a edge function sin auth → respuesta `403`.
- Con compra activa: `<video>` renderizado, URL firmada presente, botón download presente.

## 3. Vista previa de CSV antes de descargar

**Editado `src/components/vault/VaultAuditPanel.tsx`**:
- Nuevo botón "Vista previa" junto a "Exportar CSV" (cuando hay permisos).
- Click abre `<Dialog>` con:
  - Título: "Vista previa del CSV — {N} filas, {M} columnas"
  - Tabla con primeras 5 filas + headers actuales (respeta filtros activos).
  - Banner amarillo si hay >100 filas: "Solo se muestran las primeras 5 — el archivo descargado contendrá {N} filas".
  - Lista de filtros activos aplicados (ej: "Acción: access_granted • Doctor: Dr. X • Fecha: últimos 7 días").
  - Botones: "Cancelar" / "Descargar CSV" (este último ejecuta el export real).
- Reutiliza la función `buildCsvContent()` extraída del export actual para garantizar paridad.

**Test extendido `src/test/e2e/vault-audit-csv.test.tsx`**:
- Click en "Vista previa" → modal abre con tabla de 5 filas.
- Verifica que las columnas mostradas coinciden con `visibleColumns` del estado.
- Click en "Descargar CSV" desde el modal → dispara descarga + cierra modal.
- Click en "Cancelar" → modal cierra sin descargar (`URL.createObjectURL` no llamado).

## 4. Watermark en miniaturas con hover-play

**Editado `src/pages/RecordingsGrid.tsx`**:
- Card de grabación: `<div onMouseEnter={() => setHoverPlay(true)} onMouseLeave={() => setHoverPlay(false)}>`.
- Si `hoverPlay && hasPurchased`:
  - Renderizar `<video autoPlay muted loop>` sobre el poster.
  - Generar `previewSessionId` con `useMemo(() => crypto.randomUUID(), [recording.id])`.
  - Montar `<DynamicWatermark sessionId={previewSessionId} email={user.email} userId={user.id} />`.
- Si `!hoverPlay` o `!hasPurchased`: solo poster estático, SIN watermark (poster es imagen pública del thumbnail).

**Test extendido `src/test/e2e/watermark-previews.test.tsx`**:
- Render `<RecordingCard>` sin hover → watermark NO en DOM.
- `fireEvent.mouseEnter(card)` con `hasPurchased=true` → watermark aparece con `data-session-id` único.
- `fireEvent.mouseLeave(card)` → watermark desmontado.
- Re-hover sobre la misma card → mismo `previewSessionId` (estable por `useMemo`).
- Hover sobre 3 cards distintas → 3 sessionIds únicos.

## 5. Pantalla "Ledger" del Wallet con estados initiated/paid/failed

**Nuevo `src/pages/WalletLedger.tsx`** (ruta `/wallet/ledger`):
- Lista paginada de `wallet_transactions` del usuario, ordenada por `created_at DESC`.
- Filtros: por status (`initiated | paid | failed | all`), por tipo (`topup | purchase | earning | refund`), por rango de fechas.
- Cada fila muestra:
  - Fecha (formato `dd MMM yyyy HH:mm`).
  - Tipo + ícono semántico (verde=earning/topup, rojo=purchase, gris=initiated).
  - Descripción (`description` field).
  - Monto con signo (+/-) y formato MXN.
  - Status badge: `initiated` (gris), `paid` (verde), `failed` (rojo).
  - Botón "Ver recibo" → modal con recibo simulado (fecha, monto, ID de transacción, link a `metadata.session_id` o `metadata.recording_id`).
- Link de "Ver detalle de compra":
  - Si `metadata.recording_id` → link a `/recordings/{id}`.
  - Si `metadata.session_id` (chat) → link a `/chat/{session_id}`.
  - Si `metadata.consultation_id` → link a `/chat` con session resaltada.

**Nuevo `src/components/wallet/ReceiptModal.tsx`**:
- Modal con recibo simulado (no PDF real, vista HTML printable).
- Campos: ID transacción, fecha emisión, descripción, monto, método (wallet/Stripe), status, referencia externa (Stripe payment_intent si aplica).
- Botón "Imprimir" (`window.print()`).

**Editado `src/pages/Wallet.tsx`**:
- Agregar tab "Movimientos" o link "Ver historial completo" → navega a `/wallet/ledger`.

**Editado `src/App.tsx`**:
- Registrar ruta `/wallet/ledger` con `<AccessGuard requireAuth>`.

**Test e2e nuevo `src/test/e2e/wallet-ledger.test.tsx`**:
- Mock 10 transacciones con statuses mixtos.
- Verifica que aparecen en orden DESC.
- Filtra por `status='paid'` → solo muestra esas.
- Click "Ver recibo" en transacción → modal abre con datos correctos.
- Verifica que link "Ver grabación" navega a `/recordings/{id}`.

## Archivos tocados

**Nuevos:**
1. `src/components/live/LiveProcessingOverlay.tsx`
2. `src/pages/WalletLedger.tsx`
3. `src/components/wallet/ReceiptModal.tsx`
4. `src/test/e2e/live-recording-states.test.tsx`
5. `src/test/e2e/recording-direct-url.test.tsx`
6. `src/test/e2e/wallet-ledger.test.tsx`

**Editados:**
7. `src/pages/LivePlayer.tsx` — integra overlay con realtime sub
8. `src/components/live/LiveEndedOverlay.tsx` — usa overlay nuevo
9. `src/components/recordings/RecordingVideoPlayer.tsx` — gating estricto antes de mount
10. `src/components/recordings/CloudflareRecordingPlayer.tsx` — mismo
11. `src/pages/RecordingPlayer.tsx` — pre-check entitlement antes de fetch URL
12. `supabase/functions/get-cloudflare-playback/index.ts` — JWT + purchase check, 403 si falla
13. `src/components/vault/VaultAuditPanel.tsx` — botón Vista previa + modal preview
14. `src/pages/RecordingsGrid.tsx` — hover-play con watermark
15. `src/pages/Wallet.tsx` — link/tab al Ledger
16. `src/App.tsx` — ruta `/wallet/ledger`
17. `src/test/e2e/vault-audit-csv.test.tsx` — extender con tests de preview modal
18. `src/test/e2e/watermark-previews.test.tsx` — extender con hover-play

**Migración SQL (si falta):**
19. Columna `recording_status` enum en `lives` table con default

## Resultado garantizado

- Live transmissions muestran overlay claro durante procesamiento de grabación con reintentos automáticos y transición a "Listo para replay".
- Grabaciones premium están blindadas: sin compra, ni el `<video>` se monta, ni la URL firmada se solicita, ni el endpoint backend la entrega (403 server-side).
- CSV de auditoría tiene preview obligatorio que muestra exactamente qué filtros/columnas/filas se exportarán.
- Hover sobre cards de grabaciones (con compra) reproduce video con watermark único; posters estáticos siguen limpios.
- Wallet Ledger consolida historial de transacciones con filtros, recibos simulados y deep-links a la compra original.
- Tests cubren: estados live/processing/ready, bloqueo directo de URL, preview CSV, hover watermark, ledger filters/recibos.

