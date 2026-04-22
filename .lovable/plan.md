

# Lista FINAL Y COMPLETA — Cierre total de auditoría

Todo lo que falta, sin más recomendaciones después. 8 hallazgos del scanner + 2 del linter + limpieza técnica.

## CRÍTICOS (errors del scanner) — 4 ítems

### 1. Realtime sin autorización de canales
`realtime.messages` no tiene RLS. Cualquier autenticado puede suscribirse a cualquier topic (chats privados, video calls, presencia).
- **Fix:** policy en `realtime.messages` que valide `topic` contra `auth.uid()` y participación real en `chat_sessions` / `lives` / `consultations`.
- Topics permitidos: `chat:{session_id}` solo si `EXISTS chat_sessions WHERE id=session_id AND (participant1_id=auth.uid() OR participant2_id=auth.uid())`.

### 2. `consultation_ratings` expone datos privados
Policy SELECT con `USING (true)` filtra patient_id, doctor_id y comentarios libres a todos los autenticados.
- **Fix:** DROP policy actual + CREATE nueva con `USING (auth.uid() = patient_id OR auth.uid() = doctor_id OR has_role(auth.uid(),'admin'))`. Para mostrar rating público, usar agregado vía `doctor_profiles.rating` (ya existe).

### 3. `push_subscriptions` publicado en Realtime
Credenciales de Web Push (endpoint, auth token, p256dh) viajan por Realtime broadcasts.
- **Fix:** `ALTER PUBLICATION supabase_realtime DROP TABLE public.push_subscriptions;`

### 4. Storage policies con substring match
3 policies usan `~~ ('%' || filename)` que permite colisión de nombres entre usuarios:
- `Purchasers can view recording files`
- `doctor-content restricted read`
- `prescriptions patient access`
- **Fix:** Reescribir con igualdad exacta del path completo `(storage.foldername(name))[1] = recording.user_id::text`, validando ownership por carpeta.

## ALTOS (warns del scanner) — 2 ítems

### 5. `ad_campaigns` expone presupuesto a anónimos
Policy pública filtra `budget`, `spent`, `target_impressions`, `target_clicks`.
- **Fix:** DROP policy pública, CREATE policy SELECT solo para columnas necesarias usando vista `ad_campaigns_public` con `security_invoker=true` que excluya columnas financieras. Cambiar `useAds.ts` para leer de la vista.

### 6. `followers` expone grafo social completo
Policy `USING (true)` revela quién sigue a quién.
- **Fix:** `USING (auth.uid() = follower_id OR auth.uid() = followed_id OR has_role(auth.uid(),'admin'))`. Counts agregados ya están en `doctor_profiles.followers_count`.

## LINTER DB — 2 ítems

### 7. Extension `pg_net` en schema public
- **Fix:** Mover a schema `extensions` (`ALTER EXTENSION pg_net SET SCHEMA extensions;`). Validar que ningún edge function llame `net.http_post` sin schema cualificado.

### 8. RLS policy con `USING (true)` en INSERT/UPDATE/DELETE
Linter detecta al menos una policy permisiva. Auditar todas las policies write con `USING/WITH CHECK (true)` y restringir.
- **Fix:** Query `pg_policies WHERE qual='true' AND cmd != 'SELECT'`, reemplazar cada una con condición específica de ownership.

## LIMPIEZA TÉCNICA — 4 ítems

### 9. 1533 `console.log/error/warn` en código de producción
- **Fix:** Crear wrapper `src/lib/logger.ts` con `log/warn/error` que solo emita si `import.meta.env.DEV`. Reemplazar masivamente con sed/codemod en `src/**/*.{ts,tsx}` (excluir tests). Mantener `console.error` solo en catch blocks críticos.

### 10. `@ts-ignore` en tests legacy
- **Fix:** Reemplazar por `@ts-expect-error` con razón documentada.

### 11. Falta i18n en features nuevos
Strings hardcoded en `LiveProcessingOverlay`, `WalletLedger`, `ReceiptModal`, `HoverPlayCard`, `RecordingPaywall`.
- **Fix:** Agregar keys a `src/lib/i18n/es.ts` y `en.ts`, reemplazar literales con `t('...')`.

### 12. Seed data y demo accounts en migraciones
`seed-demo-users` y referencias `Demo1234!` en código de producción.
- **Fix:** Confirmar que esa edge function requiere `SUPABASE_SERVICE_ROLE_KEY` y no se puede invocar desde frontend. Documentar que solo es ejecutable manualmente.

## VALIDACIÓN FINAL

Después de aplicar todo:
1. Re-run `supabase--linter` → 0 issues (excepto `pg_net` si se decide no mover por compatibilidad).
2. Re-run `security--run_security_scan` → 0 errors, máximo 1-2 warns aceptados con justificación documentada.
3. Re-run `vitest` → 258/258 tests verdes.
4. Marcar findings como `mark_as_fixed` en el scanner con explicación de cada uno.

## ARCHIVOS A MODIFICAR

**Migración SQL única:**
- `supabase/migrations/{timestamp}_final_security_hardening.sql` — cubre items 1-8.

**Frontend:**
- `src/lib/logger.ts` (nuevo) — wrapper de logs.
- Codemod sobre `src/**/*.{ts,tsx}` para reemplazar `console.*` (item 9).
- `src/hooks/useAds.ts` — leer de vista `ad_campaigns_public` (item 5).
- `src/lib/i18n/es.ts` y `en.ts` — keys nuevas (item 11).
- `src/components/live/LiveProcessingOverlay.tsx`, `src/pages/WalletLedger.tsx`, `src/components/wallet/ReceiptModal.tsx`, `src/components/recordings/HoverPlayCard.tsx`, `src/components/recordings/RecordingPaywall.tsx` — usar `t()`.

**Tests legacy:**
- `src/pages/__tests__/LivesGrid.rejection.test.tsx` y similares — `@ts-ignore` → `@ts-expect-error`.

## RESULTADO GARANTIZADO POST-EJECUCIÓN

- Realtime con RLS por topic (no más subscripción cross-user).
- `consultation_ratings`, `followers`, `push_subscriptions`, `ad_campaigns` blindados a su scope correcto.
- Storage policies validan path completo, no substring.
- `pg_net` fuera de schema público.
- Cero policies `USING (true)` en operaciones de escritura.
- Logger condicional en producción (sin ruido en consola).
- i18n completo para los 5 features nuevos.
- 258/258 tests pasando + scanner limpio.

**Esta es la lista completa. No hay más hallazgos pendientes después de esto — solo lo que ya está documentado en memoria como "by design" (ad_events anonymous insert, demo accounts, pg_net si se mantiene).**

