
Objetivo: corregir por completo estos 3 frentes sin parches frágiles:
1) entrega OTP + visibilidad del texto,
2) “Explorar Doctores” mostrando todos con paginación real,
3) “Aceptar llamada” entrando directo a sala con nombre correcto de participante.

Diagnóstico confirmado en tu código actual:
- OTP no llega por dos bloqueos reales:
  - En `DoctorVault.tsx`, el doctor intenta leer `profiles(email,name)` del paciente desde cliente; esa lectura está restringida y falla (ya se ve patrón 406 en otras rutas con `.single()`).
  - El doctor intenta insertar notificación `type: 'system'` para `user_id = patientId`; la política actual de `notifications` no permite ese INSERT (solo propio usuario + casos específicos de `video_call` y `rating_request`).
- En “Explorar Doctores”, aunque hay paginación visual de 20 por página, la carga inicial trae todo de una sola consulta. Con catálogos grandes queda expuesta al límite por consulta (truncamiento), por eso no garantiza “absolutamente todos”.
- “Aceptar llamada” hoy solo navega a `/video-call?...` y deja al usuario en estado `idle` esperando clic en “Unirse”; no es ingreso directo.
- Sobre nombre en sala:
  - `get-daily-token` ya pone `user_name` desde perfil.
  - `create-daily-room` (token owner) también lo pone.
  - Falta robustecer fallback y asegurar consistencia en TODOS los flujos de join.

Implementación propuesta (secuencia exacta):

1) OTP 100% confiable (backend único, validado y auditable)
- Refactorizar `supabase/functions/send-otp-email/index.ts` para que haga el flujo completo server-side:
  1. Validar JWT y extraer usuario solicitante.
  2. Verificar que el solicitante es doctor y tiene relación válida con el paciente (por `vault_access` + `vault_files.patient_id`).
  3. Generar OTP en backend (6 dígitos, vencimiento 2 min).
  4. Insertar OTP en `expediente_otp`.
  5. Obtener email/nombre del paciente con cliente admin (sin depender de RLS de frontend).
  6. Insertar notificación in-app al paciente.
  7. Enviar correo OTP.
  8. Responder `{ success: true }` o error explícito tipado.
- Ajustar `DoctorVault.tsx`:
  - Reemplazar lógica actual de inserción OTP + notificación + lectura de perfil por una sola invocación a `send-otp-email`.
  - Manejo de error estricto (sin silencios): si falla función, mostrar motivo real.
- Contraste visual:
  - Cambiar el texto “Requiere verificación OTP para acceder” a una clase oscura legible (`text-foreground`/`font-medium`) en el banner warning.

2) “Explorar Doctores” mostrando todos con paginación robusta (20 por página)
- Migración de base de datos: crear función pública paginada de lectura segura (security definer) para evitar límites de carga masiva y mantener columnas públicas:
  - Entradas: `p_page`, `p_page_size` (forzado a 20), `p_search`, `p_specialty`.
  - Salida: filas de doctores + `total_count` para cálculo de páginas.
  - Orden estable (rating desc, followers desc, created_at desc, id) para evitar saltos entre páginas.
- Actualizar `src/pages/Doctors.tsx`:
  - Pasar de “traer todo + slice local” a “traer página actual desde backend”.
  - Al cambiar búsqueda/especialidad: reset a página 1 y recargar.
  - Mantener 20 exactos por página y paginador actual.
  - Mostrar total real desde `total_count`.
- Resultado: escala a catálogos muy grandes sin truncar.

3) Aceptar llamada = entrar directo a sala
- `IncomingCallModal.tsx`:
  - Navegar con bandera de auto-ingreso (ej. `?consultation=...&autojoin=1`).
- `VideoCall.tsx`:
  - Leer `autojoin`.
  - Si `autojoin=1`, ejecutar `startCall()` automáticamente una sola vez al montar (con guard para no duplicar).
  - Mantener botón manual para casos normales.
  - En flujo de paciente/residente, si aún no existe sala, mostrar estado claro y retry automático corto o mensaje preciso.
- Opcionalmente alinear `CallWaitingBanner.tsx` y toast-action de notificación para que también usen `autojoin=1` (consistencia UX).

4) Nombre de usuario en sala para doctor/residente/paciente
- `get-daily-token`:
  - Mantener `user_name` desde `profiles.name`, pero agregar fallback sólido:
    1) `profiles.name`,
    2) `auth.user.user_metadata.name`,
    3) alias por rol.
- `create-daily-room` owner token:
  - Mismo criterio de fallback para doctor.
- `VideoCall.tsx`:
  - En invocación de token para participante no-owner, enviar opcional `displayName` (si existe) para reforzar consistencia.
- Con esto, Daily siempre recibe nombre humano correcto en token de ambos lados.

Cambios de archivos previstos:
- `supabase/functions/send-otp-email/index.ts` (refactor completo de flujo OTP).
- `src/pages/DoctorVault.tsx` (invocación única backend + toasts + contraste de texto).
- `supabase/migrations/<new>.sql` (función paginada pública para directorio médico).
- `src/pages/Doctors.tsx` (paginación server-side real 20/página).
- `src/components/videocall/IncomingCallModal.tsx` (autojoin en aceptar).
- `src/pages/VideoCall.tsx` (autojoin real y guardas anti-duplicado).
- `supabase/functions/get-daily-token/index.ts` (fallback robusto de `user_name`).
- `supabase/functions/create-daily-room/index.ts` (fallback consistente owner).

Validación end-to-end que ejecutaré tras implementar:
1) OTP
- Doctor solicita OTP desde Vault.
- Verificar:
  - se crea registro en `expediente_otp`,
  - llega notificación al paciente,
  - llega email,
  - OTP válido 2 minutos y de un solo uso,
  - texto de warning legible en UI.
2) Explorar Doctores
- Confirmar total real, 20 por página, navegación completa hasta última página.
- Probar filtros + búsqueda + reset a página 1.
3) Videollamada
- Doctor inicia llamada.
- Paciente pulsa “Aceptar” y entra directo sin segundo clic.
- Ambos conectan audio/video.
- Verificar nombres visibles en sala para doctor/paciente (y residente en su flujo de join).

Riesgos cubiertos:
- Evitar dependencias del frontend en datos sensibles de `profiles`.
- Evitar inserciones bloqueadas por RLS desde cliente para notificaciones OTP.
- Evitar truncamiento silencioso de directorio médico por límites de consulta.
- Evitar doble ejecución de `startCall` con guard de autojoin.
