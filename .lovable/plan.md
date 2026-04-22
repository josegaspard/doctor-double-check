

# Plan: 5 features finales — tests e2e por rol, watermark, Vault simulado, chat persistente y paywall de grabaciones

## 1. Tests e2e por rol (guards, paywalls, entitlements)

Crear `src/test/e2e/role-access.test.tsx` con suites por rol que rendericen `<App />` con un `MemoryRouter` apuntando a rutas sensibles y verifiquen el comportamiento esperado:

| Rol | Rutas testeadas | Resultado esperado |
|-----|----------------|--------------------|
| `visitor` (no auth) | `/chat`, `/vault`, `/medical-supplies`, `/doctor-dashboard`, `/admin` | Redirige a `/login` o muestra `<AccessDenied />` |
| `patient` | `/medical-supplies`, `/admin/*`, `/doctor-dashboard`, `/resident-groups` | Bloqueado vía `<AccessGuard>` o `Navigate` |
| `patient` sin entitlement | `/chat` con doctor sin pago previo | Muestra `<PaywallModal>` |
| `doctor` (approved) | `/doctor-dashboard`, `/doctor-availability`, `/chat` | Acceso permitido |
| `doctor` (pending) | `/doctor-dashboard` | `<DoctorStatusAlert>` visible |
| `resident` | `/marketplace`, `/admin/*`, `/create-prescription`, `/chat` con paciente | Bloqueado |
| `admin` | `/admin/*`, `/admin/users`, `/admin/credentials` | Acceso completo |

Mockear `useAuth` con factory `mockAuth(role, opts)` y `supabase.from(...)` para devolver entitlements/chat sessions controlados. Validar con `expect(screen.getByText(...))` los textos clave de bloqueo.

## 2. Watermark dinámico + expiración de URLs privadas

**Crear `src/components/recordings/DynamicWatermark.tsx`** — overlay absoluto sobre el `<video>` del player con:
- Texto: `${user.email} · ${userId.slice(0,8)} · ${formatDateTime(now)}`
- Posición rotada 4 esquinas cada 30s para evitar masking estático
- `pointer-events-none`, `text-white/30 text-[10px]`, `mix-blend-difference`
- Recalcula timestamp cada minuto vía `useEffect` + `setInterval`

**Integrar en `RecordingVideoPlayer.tsx` y `CloudflareRecordingPlayer.tsx`** envolviendo el `<video>` con un wrapper `relative` que contenga `<DynamicWatermark />`.

**Expiración de URLs privadas**: en `RecordingPlayer.tsx`, registrar el momento de generación del signed URL (`urlGeneratedAt = Date.now()`). Después de 1h (TTL del signed URL de Supabase Storage para `recordings`), si el video falla con error 403/410, mostrar overlay `<LiveEndedOverlay>`-style que diga "Sesión expirada — recarga para continuar viendo" con botón que llame `regenerateSignedUrl()` (re-fetch del recording → nueva signed URL).

Detectar expiración con listener `onError` del `<video>` que verifique `now - urlGeneratedAt > 55*60*1000` para ofrecer renovación proactiva antes de que falle.

## 3. Simulador de subida al Vault con validaciones y confirmación

**Crear `src/components/vault/VaultUploadSimulator.tsx`** — botón "Subir al Vault" que abre un dialog con:
- Drop zone que acepta `.pdf, .jpg, .jpeg, .png, .dcm` (estudios)
- Validación frontend:
  - Tipo MIME: rechazar si no está en whitelist con toast
  - Tamaño máximo 20MB
  - Nombre sanitizado (sin caracteres especiales)
- Barra de progreso real usando `XMLHttpRequest` con `onprogress` para mostrar % real durante upload a Storage `vault-files` bucket
- Tras upload exitoso, paso de **"Confirmación de permisos"** que muestra:
  - Lista de doctores con acceso actual al patient (consulta a `vault_access`)
  - Checkbox por doctor: "Otorgar acceso a este archivo"
  - Por defecto **ningún doctor seleccionado** (privacy-first)
  - Botón "Guardar archivo" que crea fila en `vault_files` + entradas en `vault_access` para los seleccionados
  - Trigger `trg_vault_access_audit` (ya existe) registra el evento

**Integrar en `Vault.tsx`** reemplazando el botón actual de upload por este componente.

**Edge function nueva `vault-upload-validate`** que valida server-side el MIME real del archivo (lectura de magic bytes con `file-type` package en Deno), evitando spoofing del header. Si MIME no coincide con tipo declarado, rechaza con 400.

## 4. Persistencia chat 1:1 + bloqueo por `entitlement_chat=false`

**Verificar persistencia**: revisar `Chat.tsx` y `ChatContext.tsx` — el historial ya se persiste en `chat_messages` table. Confirmar que cuando se cierre/reabra la sesión, los mensajes se cargan correctamente con paginación (load 50 últimos, scroll para más).

**Bloqueo por entitlement**: en `ChatMessagesPanel.tsx` o donde está el input:
- Antes de cada `sendMessage()`, consultar `entitlements` table:
  ```ts
  const { data } = await supabase.from('entitlements')
    .select('is_active, expires_at')
    .eq('user_id', user.id).eq('type', 'chat').maybeSingle();
  const hasChat = data?.is_active && new Date(data.expires_at) > new Date();
  ```
- Si `!hasChat` Y el usuario es `patient` Y la otra parte es `doctor`, mostrar `<PaywallModal>` (componente ya existe) con:
  - Precio dinámico desde `doctor_profiles.consultation_fee` del doctor
  - Botón "Pagar con Wallet" → llama RPC `process_consultation_purchase(doctorId, fee)` (ya existe)
  - Botón "Pagar con Stripe" → invoca edge function `create-consultation-checkout`
  - On success: refrescar entitlement, cerrar modal, permitir envío inmediato

**Disable input** con `<Textarea disabled />` y placeholder "Compra una consulta para enviar mensajes" cuando `!hasChat`.

## 5. Paywall real para grabaciones con estados de wallet visibles

**Modificar `src/pages/RecordingPlayer.tsx`**:
- Si `!hasPurchased(recordingId)` y user no es admin/owner, mostrar `<RecordingPaywall>` en lugar del player.
- Crear nuevo componente `src/components/recordings/RecordingPaywall.tsx`:
  - Card con thumbnail del recording, título, doctor, precio
  - Estado del wallet visible: `<WalletStatusBadge status={txStatus} balance={walletBalance} />`
  - Estados visuales con color-coding:
    - `idle` (default): badge gris "Saldo: $X"
    - `initiated` (compra en curso): badge azul + spinner "Procesando pago…"
    - `paid` (success): badge verde "✓ Pagado · Cargando reproductor…" — auto-hide tras 2s
    - `failed`: badge rojo "✗ Pago rechazado" + botón "Reintentar"
  - Botones: "Pagar con Wallet ($X)" y "Pagar con Stripe"
  - Lógica:
    - Wallet: invocar `purchaseWithWallet(recordingId)` del hook `usePurchases`. Setea `txStatus='initiated'` durante await; al resolver, `setTxStatus('paid')` y forzar `await refresh()` del hook + re-render del player **sin recargar página** (cambia condición `hasPurchased` → true).
    - Stripe: invocar `purchaseWithStripe(recordingId)` → redirect a checkout. Al volver con query `?recording_paid=success`, hook refetch automático + render del player.

**Suscripción realtime opcional** en `RecordingPlayer.tsx` a la tabla `purchases` filtrada por `user_id=current` para detectar la confirmación del webhook de Stripe sin polling, marcando `txStatus='paid'` y montando el player automáticamente.

## Archivos tocados

**Nuevos:**
1. `src/test/e2e/role-access.test.tsx` — suite de tests por rol
2. `src/test/e2e/helpers.tsx` — `mockAuth()`, `mockSupabase()`, `renderApp()`
3. `src/components/recordings/DynamicWatermark.tsx`
4. `src/components/vault/VaultUploadSimulator.tsx`
5. `src/components/recordings/RecordingPaywall.tsx`
6. `supabase/functions/vault-upload-validate/index.ts` — validación server-side de MIME

**Editados:**
7. `src/components/recordings/RecordingVideoPlayer.tsx` — integrar `<DynamicWatermark>`
8. `src/components/recordings/CloudflareRecordingPlayer.tsx` — integrar `<DynamicWatermark>`
9. `src/pages/RecordingPlayer.tsx` — paywall + detección de URL expirada + realtime de purchases
10. `src/pages/Vault.tsx` — reemplazar upload con `<VaultUploadSimulator>`
11. `src/components/chat/ChatMessagesPanel.tsx` — bloqueo input + paywall trigger por entitlement
12. `src/contexts/ChatContext.tsx` — exponer `entitlementChat` y método `refreshEntitlement()`

## Resultado garantizado

- Tests automáticos cubren acceso por rol en rutas críticas; cualquier regresión de guards/paywalls falla CI.
- Cada video de grabación muestra watermark dinámico con identidad del usuario y timestamp; URLs expiradas se detectan y se ofrece renovación.
- Subida al Vault es visualmente clara con progreso real, valida tipo y tamaño, y exige confirmación explícita de qué doctores tendrán acceso (default = ninguno).
- Chat 1:1 persiste entre sesiones; pacientes sin entitlement ven input deshabilitado y modal de pago end-to-end (Wallet o Stripe) que desbloquea inmediato sin recarga.
- Compra de grabación muestra estado del wallet en tiempo real (initiated→paid→failed) y abre el player automáticamente al confirmarse el pago, sin recargar la página.

