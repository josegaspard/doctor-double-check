

# Plan: Fix UI live card + precio doctores universal + chat preview + 4 features nuevos

Son 6 ítems distintos. Aviso: las **primeras 3 son cambios chicos y rápidos**. Las **últimas 3 son features grandes** (auditoría Vault, DRM, tokens firmados live) — las divido en sub-tareas y aclaro alcance para que sepas exactamente qué entrego.

## 1. Fix UI: card del doctor en live (PC + tablet + móvil)

Pantalla: el badge `verificado` se solapa con el nombre y se corta como "verifi...do". Causa: `<Badge>` está al lado de `<span>` especialidad sin contenedor flexible.

**Archivo:** `src/pages/LivePlayer.tsx` líneas ~631-644
- Reorganizar bloque a 2 filas: fila 1 = nombre + badge `verificado` (con `flex-wrap`); fila 2 = especialidad truncada.
- Badge `verificado`: usar `shrink-0`, texto `text-[10px] leading-none whitespace-nowrap`, ícono más chico.
- Especialidad: `truncate block w-full`.
- Card padre: añadir `min-w-0` al `flex-1` para permitir truncado correcto.
- Mostrar también COFEPRIS debajo de Cédula (hoy solo muestra cédula): `Permiso COFEPRIS: {live.doctorCofepris}`.
- Los botones "Ver Perfil" / "Iniciar chat privado" responsive: en móvil apilados, en desktop en línea (`flex-col sm:flex-row`).

## 2. Precio del doctor visible para TODOS los roles en `/doctors`

**Archivo:** `src/pages/Doctors.tsx` línea ~823
- Cambiar la condición `role === 'patient' && doctor.consultation_fee > 0` a solo `doctor.consultation_fee > 0`.
- El precio se mostrará igual a visitantes, doctores, residentes y admins. (Los residentes ya tienen lógica de descuento 50% aplicada vía `get_price_for_user` al momento del checkout, así que mostrar precio base es correcto.)

## 3. Preview del último mensaje del chat: NO mostrar `[Imagen: archivo.jpg]`

**Archivo:** `src/contexts/ChatContext.tsx` función `sendMessage` línea ~427
- Crear helper `formatMessagePreview(content: string)` que detecte:
  - `📷 [Imagen: ...]` → preview = `📷 Foto`
  - `📎 [Archivo: ...]` → preview = `📎 Archivo` (o `📎 nombre.ext` corto)
  - `📋 ...prescriptions/...` → `📋 Receta médica`
  - texto normal → primeros 100 chars como hoy
- Aplicar el helper antes de actualizar `last_message` en `chat_sessions`.
- Adicional: en `ChatSessionItem.tsx` línea 167, sanitizar a la vista en caso de mensajes legacy ya guardados con el formato feo (regex de detección y reemplazo en render).

## 4. Verificación médica con estados (pending/approved/rejected) + explicación

Hoy `doctor_profiles.status` ya tiene `pending|approved|rejected`. Falta UI que lo muestre y un campo para razón de rechazo en COFEPRIS.

**Migración SQL:**
- Agregar columnas a `doctor_profiles`: `cofepris_status verification_status default 'pending'`, `cofepris_rejection_reason text`, `cedula_status verification_status default 'pending'`, `cedula_rejection_reason text`.
- Crear enum `verification_status as enum ('pending','approved','rejected')` si no existe.
- Exponer las 4 columnas nuevas en la view `doctor_profiles_public`.

**Frontend:**
- Nuevo componente `src/components/doctor/CredentialStatusBadge.tsx`: recibe `{ type: 'cedula'|'cofepris', status, value, rejectionReason }`, renderiza badge con color según estado (verde/amarillo/rojo) + tooltip o popover explicativo con la razón si está rechazado.
- Reemplazar usos actuales (`LivePlayer.tsx`, `LivesGrid.tsx`, `ContentGallery.tsx`, `DoctorProfileCard.tsx`, `ContentPreviewModal.tsx`) por este componente unificado.
- En `AdminVerifications.tsx` añadir botones para aprobar/rechazar cédula y COFEPRIS por separado, con campo de razón de rechazo cuando se rechaza.

## 5. Panel de auditoría del Vault (accesos, revocaciones, denegados)

**Migración SQL:**
- Tabla `vault_audit_log`:
  - `id uuid pk`, `file_id uuid fk vault_files`, `actor_id uuid` (quien actuó), `patient_id uuid` (dueño), `action text` (`accessed|access_denied|access_granted|access_revoked|otp_required|otp_failed`), `metadata jsonb`, `created_at timestamptz default now()`.
- RLS: `SELECT` permitido al paciente dueño (`patient_id = auth.uid()`) y al doctor actor (`actor_id = auth.uid()`); `INSERT` solo SECURITY DEFINER vía función `log_vault_action(...)`.
- Trigger en `vault_access`: al INSERT registrar `access_granted`, al UPDATE con `revoked_at` registrar `access_revoked`.
- Modificar edge function/RPC que sirve vault files para insertar `accessed` cuando se entrega URL firmada y `access_denied` cuando RLS rechaza.

**Frontend:**
- Nuevo componente `src/components/vault/VaultAuditPanel.tsx` (tabla con: fecha, doctor, archivo, acción, color por tipo).
- Integrar en `src/pages/Vault.tsx` (tab "Auditoría") para el paciente.
- Integrar en `src/pages/DoctorVault.tsx` (vista filtrada por `actor_id = self`) para el doctor: ve sus propios accesos y cuáles le fueron revocados.

## 6. DRM reforzado: bloqueo descargas + página de explicación

**Archivos nuevos:**
- `src/pages/AccessDenied.tsx`: página con explicación legal "Este contenido está protegido. Las descargas directas están deshabilitadas para proteger la confidencialidad médica..."

**Modificaciones:**
- `src/components/recordings/CloudflareRecordingPlayer.tsx`, `RecordingVideoPlayer.tsx`, `VaultFilePreviewModal.tsx`:
  - Añadir `onContextMenu={e => e.preventDefault()}` (ya existe en algunos, validar todos).
  - Atributos `controlsList="nodownload noremoteplayback"` y `disablePictureInPicture` en `<video>`.
  - Para iframes PDF: usar `blob: URL` + `#toolbar=0&navpanes=0` (ya implementado, validar).
- En descarga de Vault: edge function valida rol antes de firmar URL. Si rol es `patient` o no es dueño/no tiene `vault_access`, devuelve 403 con `redirect: '/access-denied?reason=role'`.
- Añadir ruta `/access-denied` en `App.tsx`.

## 7. Notificaciones inmediatas wallet/ledger en cambios de estado

Hoy `process_consultation_purchase` y `purchase-recording-wallet` ya escriben `wallet_transactions` y `notifications`. Falta cubrir el cambio `initiated → paid → failed` en compras vía Stripe.

**Migración SQL:**
- Agregar columna `status text default 'initiated'` a `wallet_transactions` si no existe (ya existe).
- Trigger `notify_wallet_status_change` AFTER UPDATE OF status ON wallet_transactions: cuando pasa de `initiated` a `paid` inserta notificación "✅ Pago confirmado: {description}"; cuando pasa a `failed` inserta "❌ Pago rechazado: {description} — intenta de nuevo".

**Frontend:**
- Suscripción Realtime en `src/contexts/WalletContext.tsx` a `wallet_transactions` filtrada por `user_id=eq.{uid}`: al recibir UPDATE muestra `toast.success` o `toast.error` y refresca balance.

## 8. Tokens firmados expirables para Live Player y Replay

Hoy `get-cloudflare-playback` retorna URL HLS sin token de firma. Cloudflare Stream soporta signed URLs con `exp` claim.

**Edge function:**
- Modificar `supabase/functions/get-cloudflare-playback/index.ts` para emitir signed URL con TTL = 2h usando Cloudflare Stream Signed URL API (header `accountId/stream/{uid}/token` con JWT firmado HS256).
- Devolver `{ playbackUrl, expiresAt }`.

**Frontend:**
- `CloudflareStreamPlayer.tsx`, `CloudflareRecordingPlayer.tsx`: detectar error HLS 403/410 y mostrar `<Alert>` con mensaje "Tu sesión expiró. Recarga el contenido para continuar." + botón "Reintentar" que vuelve a llamar a `get-cloudflare-playback`.
- Refrescar URL automáticamente cada 90 min (antes de expirar).

## Archivos tocados (resumen)

**Migraciones SQL** (1 nueva):
- Enum `verification_status` + 4 columnas en `doctor_profiles` + view `doctor_profiles_public`
- Tabla `vault_audit_log` + RLS + trigger sobre `vault_access`
- Trigger `notify_wallet_status_change` sobre `wallet_transactions`

**Edge functions:**
- `get-cloudflare-playback` (signed URLs + expiración)
- Helper para registrar audit en accesos vault

**Frontend nuevos:**
- `src/components/doctor/CredentialStatusBadge.tsx`
- `src/components/vault/VaultAuditPanel.tsx`
- `src/pages/AccessDenied.tsx`
- Helper `formatMessagePreview` en `src/lib/utils.ts`

**Frontend modificados:**
- `src/pages/LivePlayer.tsx` (fix UI card)
- `src/pages/Doctors.tsx` (precio universal)
- `src/contexts/ChatContext.tsx` (preview limpio)
- `src/components/chat/ChatSessionItem.tsx` (sanitización legacy)
- `src/contexts/WalletContext.tsx` (realtime status notif)
- `src/pages/Vault.tsx` y `DoctorVault.tsx` (tab auditoría)
- `src/pages/AdminVerifications.tsx` (aprobar/rechazar cédula y COFEPRIS por separado)
- `src/components/recordings/*Player.tsx` y `VaultFilePreviewModal.tsx` (DRM hardening)
- `src/components/live/CloudflareStreamPlayer.tsx` (manejo token expirado)
- `src/App.tsx` (ruta `/access-denied`)

## Notas honestas

- **Cloudflare Stream Signed URLs** requieren que el campo `requireSignedURLs=true` esté activado por video en Cloudflare. La edge function lo activará para todos los nuevos uploads vía API; los videos antiguos seguirán siendo accesibles sin firma hasta que un admin corra una migración de backfill (te dejo nota).
- **DRM real (Widevine/FairPlay)** no es factible sin contrato enterprise con Cloudflare. Lo que entrego es "DRM-like UX": bloqueo de descarga, click derecho, controles nativos, validación de rol en backend. Suficiente para cumplimiento HIPAA-equivalente en MX.
- **Auditoría vault**: el evento `accessed` se registra cuando se firma la URL, no cuando el usuario realmente abre el archivo (no podemos detectar eso desde backend sin tracking adicional).

