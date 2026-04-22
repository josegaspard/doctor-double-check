<final-text>
## Cierre total final, completo, sin tocar el flujo de En Vivo

No voy a proponer cambios al reproductor/live/Daily ni a la lógica de transmisión. El cierre se enfoca en lo que sí sigue generando recomendaciones, ruido o deuda fuera de En Vivo.

### 1) Correcciones reales que aún faltan en frontend
1. **Eliminar warning activo de refs en `LanguageSwitcher`**
   - Ajustar `src/components/settings/LanguageSwitcher.tsx` y, si hace falta, el wrapper `src/components/ui/popover.tsx`.
   - Objetivo: quitar los warnings de `Function components cannot be given refs` en consola.

2. **Terminar la limpieza de logs en producción**
   - Ya existe `src/lib/logger.ts`, pero siguen quedando ~1552 usos de `console.*` en app code.
   - Reemplazar en frontend productivo por `logger.*` y dejar `console.error` solo donde sea realmente crítico.
   - Prioridad alta en hooks/context/pages más visibles.

3. **Quitar los `@ts-ignore` legacy**
   - Cambiar en:
     - `src/pages/__tests__/Doctors.tablet.test.tsx`
     - `src/pages/__tests__/LivesGrid.credentials.test.tsx`
     - `src/pages/__tests__/LivesGrid.rejection.test.tsx`
   - Usar `@ts-expect-error` con motivo explícito.

4. **Conectar i18n que ya existe pero no se está usando**
   - Ya están las keys nuevas en `src/lib/i18n/es.ts` y `en.ts`.
   - Falta usarlas en:
     - `src/pages/WalletLedger.tsx`
     - `src/components/wallet/ReceiptModal.tsx`
     - `src/components/recordings/RecordingPaywall.tsx`
     - `src/components/recordings/HoverPlayCard.tsx`
   - No tocaré el comportamiento live; si se decide internacionalizar `LiveProcessingOverlay`, sería solo texto, no lógica.

5. **Corregir inconsistencia en compra Stripe de grabaciones**
   - `create-recording-checkout` redirige con `?purchased=true`
   - `RecordingPlayer` escucha `?recording_paid=success`
   - Unificar ambos lados para que el unlock post-checkout no dependa de casualidad/realtime.

6. **Arreglar el “Ledger completo” del wallet**
   - `WalletLedger` consume `transactions` del `WalletContext`, pero el contexto solo trae 50 filas.
   - La pantalla dice “historial completo”, pero hoy no lo es.
   - Solución: consulta propia paginada/directa en `src/pages/WalletLedger.tsx`, manteniendo filtros, recibos y deep-links.

7. **Pulir copy y coherencia de UI en wallet/recibos**
   - `WalletLedger` y `ReceiptModal` siguen con textos hardcoded en español.
   - Alinear labels, estados (`initiated/paid/failed`) y CTAs con i18n y con el resto del sistema.

### 2) Seguridad / backend: lo que sí sigue pendiente de verdad
8. **Endurecer storage RLS con path exacto**
   - La migración reciente mejoró políticas, pero en varios casos sigue usando comparación por filename/fallback.
   - Reescribir acceso en buckets sensibles para validar path completo/carpeta real:
     - `recordings`
     - `doctor-content`
     - `prescriptions`
   - Objetivo: evitar colisiones por mismo nombre de archivo entre usuarios.

9. **Normalizar findings del scanner para que no “reaparezcan”**
   - Varias recomendaciones ya no son bugs activos, pero siguen saliendo porque el scanner quedó desactualizado o marcado como ignored con justificación antigua.
   - Rehacer cierre formal:
     - rerun linter/scan
     - actualizar finding details
     - marcar fixed los que sí quedaron resueltos
     - dejar ignorados solo los verdaderamente “by design”

### 3) Cosas que te siguen apareciendo como “recomendaciones”, pero NO son nuevas correcciones del producto
Estas no son bugs nuevos del app; son ruido recurrente del scanner/configuración si no se normalizan:

10. **`realtime.messages`**
   - La recomendación puede seguir saliendo.
   - Es un schema reservado de plataforma; no es una migración normal del repo.
   - No lo seguiría persiguiendo como bug de app mientras el acceso real a tablas siga protegido por RLS.

11. **Views públicas con `security_invoker = false`**
   - `profiles_public`, `doctor_profiles_public`, `resident_profiles_public`
   - Hay migraciones viejas que explícitamente las dejaron así para que la búsqueda pública no se rompa.
   - Si el scanner las vuelve a reportar, no significa que haya aparecido un bug nuevo.

12. **Warnings “by design” del linter/security**
   - `ad_events` insert abierto para analytics
   - `ad_config` / `ad_placements` lectura pública para servir anuncios
   - `avatars` / `thumbnails` públicos
   - `pg_net` en `public` si se decide mantener por compatibilidad
   - protección de contraseñas filtradas desactivada, si se mantiene esa decisión
   - Si no quieres verlos más, hay que cerrar el ciclo de findings; no seguir corrigiendo UI/backend una y otra vez.

13. **Los chips/sugerencias de Lovable de tus screenshots**
   - “Agregar auditoría de seguridad UI”, “Create admin role routing map”, etc.
   - No encontré esas cadenas en el código.
   - Eso apunta a sugerencias/meta-UI de la herramienta, no a tareas pendientes dentro de tu app.

### 4) Validación final para cerrar de verdad
14. **QA final sin tocar En Vivo**
   - Revisar consola en `/app`, `/wallet`, `/wallet/ledger`, `/recordings`, `/recording/:id`, admin screens.
   - Confirmar:
     - 0 warnings de refs
     - ledger realmente completo/paginado
     - recibos y filtros correctos
     - compra Stripe de grabación vuelve y desbloquea correctamente
     - i18n conectado
     - hover preview/paywall/download guardrails siguen bien

15. **Cierre de auditoría**
   - Re-ejecutar linter + security scan
   - Marcar fixed/ignored correctamente
   - Dejar documentado qué findings son:
     - resueltos
     - by design
     - platform-level/no self-serve

## Lista final, completa, sin añadir más después
### Pendiente real para corregir
- Warning de refs en `LanguageSwitcher` / `Popover`
- Limpieza real de `console.*`
- `@ts-ignore` legacy
- i18n conectado en wallet/paywall/receipt/hover preview
- Redirect mismatch Stripe grabaciones
- Wallet ledger no es realmente completo
- Storage RLS con validación exacta de path
- Normalizar findings del scanner para que no parezca que “siguen saliendo cosas”

### No seguir persiguiendo como bugs nuevos
- `realtime.messages` reportado por scanner
- views públicas con `security_invoker=false` por diseño
- warnings by design de ads/storage/extensiones/auth config
- chips/sugerencias visuales de Lovable fuera del repo
</final-text>