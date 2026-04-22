

# Plan: Cierre final — focus persistente, CSV con permisos, watermark en previews, búsqueda con revoke, atajos extendidos

## 1. Test e2e: PaywallModal preserva texto y focus tras cerrar

**Nuevo `src/test/e2e/chat-paywall-persistence.test.tsx`**:
- Render `<ChatMessagesPanel>` con paciente sin entitlement.
- Usuario escribe "Hola doctor, tengo dolor" en el input → verifica que `value === "Hola doctor, tengo dolor"`.
- Presiona Enter → `handleSendIntercept` se dispara → `paywallOpen === true`.
- Cierra modal con Escape (`fireEvent.keyDown(document, { key: 'Escape' })`).
- Verifica:
  - `value` del input sigue siendo "Hola doctor, tengo dolor" (texto preservado).
  - Tras `setTimeout(50ms)` el `document.activeElement === inputRef.current` (focus restaurado).
  - Presiona Enter de nuevo → paywall reabre, `onSend` nunca se llamó.
- Repite ciclo 3 veces → verifica que el input nunca pierde el texto y que `onSend` permanece en 0 invocaciones.

## 2. Test e2e: CSV auditoría con permisos/entitlements

**Nuevo `src/test/e2e/vault-audit-csv-permissions.test.tsx`**:
- Caso A — Doctor con entitlement vigente sobre 2 archivos (de 5 totales del paciente):
  - Mock `vault_audit_log` con 10 eventos (2 propios, 3 sobre archivos accesibles, 5 sobre archivos no accesibles).
  - Verifica que el CSV exportado contiene exactamente 5 filas (eventos donde `actor_id = doctor` o `file_id IN allowed`).
  - Verifica que columnas sensibles (`patient_id` completo, `metadata.diagnosis`) están omitidas del export del doctor — solo IDs truncados o vacíos.
- Caso B — Doctor sin acceso vigente (entitlement expirado):
  - El botón "Exportar CSV" está `disabled` con `aria-disabled="true"`.
  - Si fuerza click → `<PaywallModal>` o `<EmptyState message="Sin permisos vigentes para auditoría">` aparece.
  - `URL.createObjectURL` nunca fue invocado.
- Caso C — Paciente exportando su propia auditoría: TODAS las columnas y filas accesibles, mime `text/csv;charset=utf-8;`, BOM presente.

## 3. Watermark en preview cards de grabaciones y chat replay

**Editado `src/components/chat/ChatMessageBubble.tsx`** (o donde se renderiza preview de video adjunto):
- Si el mensaje contiene un archivo de video (`message.attachment_type === 'video'`), envolver `<video>` en `<div className="relative">` y montar `<DynamicWatermark email={user?.email} userId={user?.id} sessionId={previewSessionId} />`.
- `previewSessionId` generado con `useMemo` por mensaje (uno por bubble, persistente al re-render).

**Editado `src/components/recordings/RecordingChatReplay.tsx`**:
- Añadir watermark al video del replay con el mismo patrón.

**Editado lista/preview de grabaciones** (`src/pages/RecordingsGrid.tsx` o `RecordingPlayer.tsx`):
- Para previews/thumbnails interactivos (hover-play o click-to-play), montar el watermark sobre el `<video>` o `<img>` thumbnail.
- En thumbnails estáticos (poster image sin video activo), NO renderizar watermark (solo cuando el video reproduce).

**Nuevo `src/test/e2e/watermark-previews.test.tsx`**:
- Render `<RecordingChatReplay>` con video adjunto → `getByTestId('dynamic-watermark')` existe.
- Verifica `data-session-id` no vacío + texto contiene email del usuario.
- Render `<ChatMessageBubble>` con `attachment_type='video'` → watermark visible con sessionId distinto al del replay.
- Render 2 bubbles + 1 replay simultáneos → 3 sessionIds únicos en el DOM (`new Set(ids).size === 3`).
- Render bubble con `attachment_type='image'` → NO se monta watermark (solo videos).

## 4. Test e2e: doctor no encuentra archivo revocado en búsqueda/filter/listado

**Nuevo `src/test/e2e/vault-revoke-search-invisibility.test.tsx`**:
- Helper que simula `get_doctor_accessible_files()` + filtros locales del UI.
- Setup inicial: doctor con acceso a `archivo-A` (nombre "rx-tumor.pdf").
- Verifica visibilidad inicial:
  - Lista completa (`getDoctorAccessibleFiles`) → contiene `archivo-A`.
  - Filtro por categoría "Imagenología" → contiene `archivo-A`.
  - Búsqueda local por término "tumor" → contiene `archivo-A`.
  - Búsqueda por término "rx" → contiene `archivo-A`.
- Paciente revoca → `vault_access` row eliminado.
- Re-verificar todas las pantallas:
  - Lista completa → 0 resultados.
  - Filtro por categoría → 0 resultados.
  - Búsqueda por "tumor" → 0 resultados (NO match parcial sobre nombre).
  - Búsqueda por "rx" → 0 resultados.
  - Búsqueda directa por `id === archivo-A` → 0 resultados.
- Adicional: `JSON.stringify(allViews)` no contiene "tumor" ni "rx-tumor.pdf" en ningún lado (zero metadata leak).

## 5. Bloqueo extendido de chat: Ctrl+Enter, Cmd+Enter, Ctrl+V, Ctrl+K, Enter en textarea

**Editado `src/components/chat/ChatMessagesPanel.tsx`**:
- Extender `handleKeyDown` para cubrir:
  ```ts
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendIntercept(); }
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSendIntercept(); } // Ctrl/Cmd+Enter
  if (e.key === 'k' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (isChatGated) setPaywallOpen(true); } // Ctrl+K
  ```
- `handlePaste` ya existe — confirmar que cubre Ctrl+V (es el evento `paste` por defecto).
- Si en algún momento se cambia a `<Textarea>`, el mismo handler aplica.

**Nuevo `src/test/e2e/chat-shortcuts-blocked.test.tsx`**:
- Para cada combinación (`Enter`, `Ctrl+Enter`, `Cmd+Enter`, `Ctrl+V`/`paste`, `Ctrl+K`):
  - Sin entitlement → `onSend` nunca se llama, `setPaywallOpen(true)` se dispara.
  - Con entitlement → comportamiento normal (Enter envía, paste inserta texto, Ctrl+K abre comando si aplica).
- Verifica que `e.preventDefault()` se invocó en cada caso bloqueado.
- Test ciclo: 5 atajos consecutivos sin entitlement → `onSend` permanece en 0, `paywallOpen` se reactivó 5 veces.
- Test de `Shift+Enter`: NO bloquea (es nueva línea), NO abre paywall.

## Archivos tocados

**Nuevos (5 tests):**
1. `src/test/e2e/chat-paywall-persistence.test.tsx`
2. `src/test/e2e/vault-audit-csv-permissions.test.tsx`
3. `src/test/e2e/watermark-previews.test.tsx`
4. `src/test/e2e/vault-revoke-search-invisibility.test.tsx`
5. `src/test/e2e/chat-shortcuts-blocked.test.tsx`

**Editados:**
6. `src/components/chat/ChatMessagesPanel.tsx` — extender `handleKeyDown` con Ctrl/Cmd+Enter y Ctrl+K; preservar texto al cerrar paywall
7. `src/components/chat/ChatMessageBubble.tsx` — montar `<DynamicWatermark>` sobre videos adjuntos
8. `src/components/recordings/RecordingChatReplay.tsx` — montar `<DynamicWatermark>` sobre videos del replay
9. `src/pages/RecordingsGrid.tsx` — watermark en previews hover-play (no en thumbnails estáticos)
10. `src/components/vault/VaultAuditPanel.tsx` — botón "Exportar CSV" con `disabled` + `aria-disabled` cuando no hay permisos vigentes; mostrar empty state si fuerza click sin acceso

## Resultado garantizado

- Paywall preserva el texto escrito y restaura el focus tras cerrar; usuario puede reintentar Enter sin perder nada y el envío sigue bloqueado.
- Exportación de CSV de auditoría respeta entitlements: doctor sin permisos no puede descargar (botón disabled + empty state); doctor con permisos solo recibe filas/columnas autorizadas; paciente recibe export completo de sus propios datos.
- Watermark DRM (email + userId + sessionId + timestamp) se muestra en videos de chat replay y bubbles de chat con video adjunto; cada preview tiene un sessionId único.
- Cuando el paciente revoca acceso, el archivo desaparece de listado, filtros y búsqueda — no hay forma de encontrarlo desde ninguna pantalla del doctor.
- Chat sin entitlement bloquea Enter, Ctrl+Enter, Cmd+Enter, Ctrl+V/paste, Ctrl+K, drop; Shift+Enter sigue funcionando como nueva línea.
- Tests cubren todos los flujos: persistencia de focus/texto, permisos en CSV, watermark en previews, invisibilidad post-revoke, atajos extendidos.

