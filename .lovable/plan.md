

# Plan: Fixtures, snapshots, CSV mejorado, accesibilidad y virtualización

## 1. Fixtures reutilizables para tests e2e

**Nuevo archivo `src/test/e2e/fixtures.ts`** con factory functions tipadas:

```ts
makeUser({ role, overrides }) → AuthUser
makeDoctorProfile({ status, overrides }) → DoctorProfile  
makePatientProfile(overrides) → PatientProfile
makeRecording({ doctorId, isPublic, fee }) → Recording
makeVaultFile({ patientId, fileName, mime }) → VaultFile
makeVaultAuditEvent({ action, patientId, actorId, fileId }) → VaultAuditEvent
makeChatSession({ patient, doctor, hasEntitlement }) → ChatSession
makeEntitlement({ userId, type, isActive, expiresAt }) → Entitlement
```

Cada factory acepta overrides parciales y genera IDs estables vía contador local (`fixture_user_1`, `fixture_doctor_2`) para tests deterministas. Los 9 archivos de tests existentes refactorizan sus mocks para usar fixtures.

## 2. Snapshots visuales por breakpoint

**Nuevo `src/test/e2e/responsive-snapshots.test.tsx`**:
- Renderiza `<DoctorCard>` (extraído como subcomponente exportable de `Doctors.tsx`) y `<CredentialStatusBadge>` con datos largos: nombre de 40 chars, especialidad larga, badges múltiples.
- Para cada breakpoint (360, 768, 1024) usa `Object.defineProperty(window, 'innerWidth')` + `vi.fn()` en `matchMedia`, y `container.querySelector` para verificar:
  - No hay `scrollWidth > clientWidth` (sin overflow horizontal)
  - El nombre tiene `truncate` aplicado cuando supera el contenedor
  - Los badges hacen wrap (más de 1 fila) cuando no caben
  - El popover de COFEPRIS abre dentro del viewport (no sale por la derecha)
- Snapshot serializado del HTML estructural (sin estilos inline que cambien) usando `toMatchInlineSnapshot()`.

## 3. CSV de auditoría mejorado + test estricto

**`src/components/vault/VaultAuditPanel.tsx`**:
- Refactor `exportCSV()` para:
  - Solo columnas visibles tras filtros (config visible-columns en estado).
  - Orden fijo: `Fecha, Acción, Archivo, Actor, Patient ID, Metadata`.
  - BOM UTF-8 (`\uFEFF`) prefijo para Excel.
  - Escape RFC4180: dobles comillas dentro de campo entre comillas; campo entre comillas si contiene `,`, `"`, `\n` o `\r`.
  - Mime `text/csv;charset=utf-8;`.

**Extender `vault-audit-csv.test.tsx`**:
- Verifica orden exacto del header.
- Inyecta valores con coma, comillas, salto de línea → valida escape.
- Verifica que filtros activos producen exactamente N filas con M columnas.
- Detecta BOM con `csv.charCodeAt(0) === 0xFEFF`.

## 4. Tests de bloqueo Enter + foco/placeholder

**`src/test/e2e/chat-keyboard-block.test.tsx`**:
- Render de `ChatMessagesPanel` con paciente sin entitlement.
- `fireEvent.keyDown(textarea, { key: 'Enter' })` → verifica que `onSend` no se llamó y que `setPaywallOpen(true)`.
- `fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })` → no debe abrir paywall (es nueva línea).
- Verifica `placeholder === 'Compra una consulta para enviar mensajes'`.
- Verifica `document.activeElement === textarea` después de cerrar paywall sin pagar (foco devuelto).
- Verifica que tras paywall exitoso el placeholder vuelve al normal.

## 5. Test de estrés realtime para audit panel

**`src/test/e2e/vault-audit-stress.test.tsx`**:
- Renderiza `<VaultAuditPanel>`, simula 200 INSERT realtime via `mockRealtimeChannel.emit()` en burst (3 ráfagas de ~70 cada 50ms).
- `await waitFor(() => screen.getAllByRole('row').length === 201)` — header + 200.
- Verifica orden DESC por `created_at` (con timestamps incrementales, el más reciente primero).
- Verifica que ningún event se duplica (Set por `id` interno).
- Verifica que scroll no rompe: `container.scrollTop = container.scrollHeight` mantiene los datos.

## 6. Banner de chat con precio real

**`src/components/chat/ChatMessagesPanel.tsx`**:
- Ya hay query a `doctor_profiles.consultation_fee` — reforzar render del banner: `Necesitas una consulta activa para enviar mensajes — $${fee.toLocaleString('es-MX')} MXN`.
- Si `consultationFee == null` → fallback "Consulta el precio con el doctor" (no romper UI).

**Extender `chat-gate.test.tsx`**:
- Mock fee = 350 → banner contiene `$350 MXN`.
- Mock fee = 1500 → banner contiene `$1,500 MXN` (verifica formato locale).
- Mock fee = null → banner contiene "Consulta el precio".

## 7. Previews ocultando metadatos sin entitlement

**`src/test/e2e/chat-previews-no-entitlement.test.tsx`**:
- Para paciente sin entitlement, la lista de chats sigue mostrando `formatMessagePreview` (no expone tokens raw como `[Imagen: scan-positivo-covid.jpg]` que filtran info clínica).
- Verifica que preview es genérico ("📷 Foto") aunque metadata interna tenga `scan-positivo-covid.jpg`.
- Verifica que URLs internas (`/prescriptions/abc-secret-token`) se renderizan como "📋 Receta médica" sin exponer el token.

## 8. Tests de accesibilidad (PaywallModal + VaultUploadSimulator)

**`src/test/e2e/accessibility.test.tsx`**:

Para `<PaywallModal>`:
- `getByRole('dialog')` existe con `aria-modal="true"`.
- Tiene `aria-labelledby` apuntando al título.
- Tab cycle: el primer Tab enfoca botón "Pagar con Wallet", segundo "Pagar con Stripe", tercero "Cerrar".
- Escape cierra el modal.
- Trap de foco: Tab desde el último vuelve al primero.

Para `<VaultUploadSimulator>`:
- Drop zone tiene `role="button"` y `aria-label="Subir archivo al vault"`.
- File input tiene label asociado.
- Lista de doctores tiene `role="list"` con cada checkbox `role="checkbox"` y `aria-checked` correcto.
- Botón "Guardar archivo" tiene `aria-disabled` cuando no hay archivo.
- Anuncio del progreso vía `role="progressbar"` con `aria-valuenow` actualizándose.

## 9. Watermark + click-derecho en URL renovada

**`src/components/recordings/RecordingVideoPlayer.tsx`** y **`CloudflareRecordingPlayer.tsx`**:
- Verificar que el handler `onContextMenu={(e) => e.preventDefault()}` está en el `<video>` y en su wrapper.
- Verificar que `<DynamicWatermark>` se monta dentro del wrapper `relative`, no dentro del `<video>` (no posible).
- Tras renovar URL (`regenerateSignedUrl`), forzar re-mount del `<video>` con `key={signedUrl}` para garantizar que el watermark sigue mostrándose y los handlers permanecen.

**`src/test/e2e/recording-protection-renewal.test.tsx`**:
- Render player con URL inicial → watermark visible (`getByTestId('dynamic-watermark')`).
- Simula click derecho → verifica `preventDefault` (event default no aplicado).
- Simula expiración + renovación de URL → re-render → watermark sigue presente, click derecho sigue bloqueado.
- Verifica que el watermark muestra timestamp actualizado tras renovación (no el original).

## 10. Virtualización de VaultAuditPanel

**`src/components/vault/VaultAuditPanel.tsx`**:
- Si `events.length > 100`, usar `@tanstack/react-virtual` (ya disponible vía dependency tree de shadcn) para virtualizar la tabla.
- Wrapper `<div ref={parentRef} className="h-[600px] overflow-auto">` + `useVirtualizer({ count, estimateSize: 56 })`.
- Solo renderizar `virtualItems`. Mantener header sticky con `position: sticky; top: 0`.
- Filtros operan sobre `events` antes de pasarlos al virtualizer (filtros no se rompen).

**`src/test/e2e/vault-audit-virtualization.test.tsx`**:
- Render con 500 eventos.
- Verifica que el DOM solo tiene ~15-20 filas renderizadas (no 500).
- `fireEvent.scroll(container, { target: { scrollTop: 5000 } })` → verifica que aparecen filas con índice ~90+.
- Aplica filtro por acción → verifica que el conteo total cambia y la virtualización se reinicia desde top.
- Limpia filtro → verifica que vuelven todas y el orden persiste.

## Archivos tocados

**Nuevos:**
1. `src/test/e2e/fixtures.ts` — factories reutilizables
2. `src/test/e2e/responsive-snapshots.test.tsx`
3. `src/test/e2e/chat-keyboard-block.test.tsx`
4. `src/test/e2e/vault-audit-stress.test.tsx`
5. `src/test/e2e/chat-previews-no-entitlement.test.tsx`
6. `src/test/e2e/accessibility.test.tsx`
7. `src/test/e2e/recording-protection-renewal.test.tsx`
8. `src/test/e2e/vault-audit-virtualization.test.tsx`

**Editados:**
9. `src/components/vault/VaultAuditPanel.tsx` — CSV con BOM/escape RFC4180 + virtualización condicional
10. `src/components/chat/ChatMessagesPanel.tsx` — banner con precio real formateado MXN
11. `src/components/recordings/RecordingVideoPlayer.tsx` — `key={signedUrl}` para re-mount + onContextMenu
12. `src/components/recordings/CloudflareRecordingPlayer.tsx` — mismo patrón
13. `src/test/e2e/vault-audit-csv.test.tsx` — extensión con orden estricto, BOM, escape
14. `src/test/e2e/chat-gate.test.tsx` — extensión con verificación de precio formateado
15. `src/pages/Doctors.tsx` — extraer `<DoctorCard>` como componente exportable para snapshots
16. `package.json` — añadir `@tanstack/react-virtual` si no está presente

## Resultado garantizado

- Fixtures unifican datos de mock; cualquier cambio de schema solo se actualiza en un lugar.
- Snapshots responsivos detectan regresiones de overflow o truncado en 360/768/1024px.
- CSV de auditoría es Excel-safe, ordenado y con escape correcto; tests fallan si cambia el formato.
- Chat bloquea Enter/Shift+Enter/click correctamente; foco y placeholder son accesibles.
- Audit panel soporta cientos de eventos en ráfaga sin perderlos ni desordenarlos, y se virtualiza con 500+ filas sin degradar el navegador.
- Banner de chat muestra el precio real del doctor en formato MXN.
- Previews de chat nunca exponen metadata sensible.
- PaywallModal y VaultUploadSimulator pasan validación de roles/aria/teclado.
- Watermark y bloqueo de click derecho persisten tras renovación de URL firmada.

