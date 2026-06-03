# Política de Seguridad — Medical Masters

## Reportar una vulnerabilidad

Si descubres una vulnerabilidad de seguridad, por favor repórtala de forma **privada** a:

- **Correo:** seguridad@medical-masters.com
- **Política completa:** https://medical-masters.com/security
- **security.txt:** https://medical-masters.com/.well-known/security.txt

Pedimos un periodo razonable de **90 días** para remediar antes de divulgación pública.

---

## Lo que ya está implementado

### Aplicación
- Auth: email/password + Google OAuth (Apple removido por política).
- **HIBP (Have I Been Pwned)** activado: bloquea contraseñas filtradas.
- **2FA TOTP** disponible en `/settings` para todos los usuarios.
- Roles separados en tabla `user_roles` (no en profiles) → previene escalación de privilegios.
- Función `has_role()` con `SECURITY DEFINER` para evitar recursión RLS.
- Forzado de re-login al cerrar todas las pestañas (`sessionGuard.ts`).
- Validación de magic-bytes en uploads del vault (`vault-upload-validate`).
- Webhooks firmados con HMAC-SHA256 (Daily, Cloudflare, Stripe).
- RLS estricta en todas las tablas con datos clínicos.
- `SECURITY DEFINER` con `search_path = public` en todas las funciones DB.
- Source maps deshabilitados en producción (`vite.config.ts`).

### Headers HTTP (vía meta tags)
- `Permissions-Policy` limitando geolocation/payment/usb/etc.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `X-Content-Type-Options: nosniff`.

### LFPDPPP
- Aviso de Privacidad accesible en `/privacy`.
- Página pública de Derechos ARCO en `/arco`.
- Tabla `arco_requests` para rastrear solicitudes (RLS: solo admins leen).
- Disclaimer de orientación médica con re-aceptación versionada.

---

## Pendiente del propietario (acción manual)

### Cloudflare / DNS
- [ ] Activar **WAF + Bot Fight Mode** en Cloudflare.
- [ ] Configurar registros **CAA** para limitar CAs (ej: `letsencrypt.org`, `cloudflare.com`).
- [ ] Activar **DNSSEC** en el registrador.
- [ ] Validar HSTS preload en https://hstspreload.org/.
- [ ] Inventariar subdominios para prevenir takeovers.

### Auditoría externa
- [ ] Pentest formal anual.
- [ ] Programa de divulgación responsable / bug bounty.
- [ ] Revisión `securityheaders.com` y `ssllabs.com` cada release mayor.
- [ ] Auditoría de cumplimiento NOM-024-SSA3-2012 y NOM-004-SSA3-2012.

### Operación
- [ ] Designar responsable y oficial de privacidad (LFPDPPP art. 30).
- [ ] Documentar plan de respuesta a incidentes y simulacro anual.
- [ ] Activar MFA en todas las cuentas Google admin (Search Console, Analytics).
- [ ] Backups de DB cifrados y geo-distribuidos.

---

## Pendiente de código (próximas iteraciones)

- [ ] Challenge MFA en flujo de login (actualmente solo enrolamiento disponible).
- [ ] Enforcement MFA obligatorio para administradores.
- [ ] Validación Zod en edge functions restantes (`create-consultation-checkout`, `notify-new-chat`, etc).
- [x] Auditoría de `console.log` en edge functions para evitar leak de PHI — **hecho 2026-06-03**: helper `_shared/log-redact.ts` (`maskEmail`/`maskName`/`maskPhone`) aplicado a 13 funciones de correo/pago/notif. Excluidas a propósito (flujo lives/llamadas): `send-live-notification-email`, `send-missed-call-email`.
- [ ] SRI en scripts de Google Fonts.
- [ ] Tabla `arco_audit_log` para rastrear acciones admin sobre solicitudes ARCO.

---

## Checklist de seguridad para edge functions (obligatorio en cada PR nueva)

Las 4 fugas de mayo-2026 (relays abiertos en `translate-news`, `send-missed-call-email`,
`send-appointment-confirmation`, `notify-admin`) ocurrieron porque funciones nuevas
nacieron sin guard heredando `verify_jwt = false`. Toda función nueva o modificada debe
confirmar **todos** estos puntos antes de mergear:

- [ ] **Auth**: llama a `requireUserJWT(req)` / `requireAdminJWT(req)` de `_shared/auth-guards.ts`,
      **o** documenta por qué es pública (ej. webhook con firma HMAC propia: Stripe, Daily, Veriff).
      No basta con `verify_jwt = true` en `config.toml`: pon el guard **dentro** del handler.
- [ ] **Ownership**: si actúa sobre un recurso (consulta, cita, pago), valida que el caller
      sea el dueño (`user.id === recurso.doctor_id`/`patient_id`), no solo que esté autenticado.
- [ ] **CORS**: usa `corsHeadersFor(req)` (allowlist), nunca `Access-Control-Allow-Origin: *`
      en funciones que mutan estado o envían correo.
- [ ] **PHI en logs**: nunca loguees email/nombre/teléfono/contenido clínico en claro.
      Usa `maskEmail`/`maskName`/`maskPhone` de `_shared/log-redact.ts`. UUIDs sí se permiten.
- [ ] **Validación de input**: tamaño máximo y tipos (idealmente Zod). Las funciones que
      llaman APIs de pago (Gemini, Resend, Stripe) deben capear longitud para evitar abuso de cuota.
- [ ] **`config.toml`**: `verify_jwt = false` SOLO con justificación escrita en un comentario.

### Estado de remediación (2026-06-03, verificado en vivo)
- ✅ Las 4 funciones del incidente responden **HTTP 401** sin auth (protegidas + desplegadas).
- ✅ Tabla `recordings` revocada a `anon` (`permission denied`) — cerró fuga de datos clínicos.
- ✅ `.env` fuera de git + ignorado; `config.toml` apunta al proyecto correcto.
- ✅ Logs PHI redactados en 13 funciones (ver arriba).
- ⏳ **CSP `unsafe-eval`**: pendiente a propósito — vive en el mismo `script-src` que `*.daily.co`;
      quitarlo puede romper el SDK de video. Requiere prueba con videollamadas activas.

### Entregabilidad de correo transaccional (Resend) — estado 2026-06-03
- ✅ DKIM (`resend._domainkey.medical-masters.com`) presente; DMARC `p=quarantine`; SPF presente.
- ✅ `RESEND_API_KEY` + `FROM_EMAIL` configurados en secrets de Supabase (prod).
- ✅ **CONFIRMADO 2026-06-03**: envío real de prueba aceptado por Resend (`error: null`,
      id `1f8e9948-…`) desde `noreply@medical-masters.com` → dominio verificado, prod funciona.
      (Test hecho con función temporal `test-deliverability`, ya borrada.)
- ⚠️ Nota: la API key Resend en credenciales locales está obsoleta (otra cuenta) — no sirve
      para tests locales; usar siempre la de los secrets de Supabase.

### Bug abierto: notificación por correo a admins rota (2026-06-03)
- `submit-contact` y `notify-admin` arman el lookup de admins como
  `GET /rest/v1/user_roles?select=profiles:profiles(email)&role=eq.admin` → **HTTP 400**
  (no hay FK directa `user_roles`→`profiles`). Resultado: `adminEmails` vacío y el correo
  a admins **nunca se envía** (el mensaje sí se guarda en `reports`).
- [ ] Fix: consulta en 2 pasos (traer `user_id` con `role=admin`, luego `profiles?id=in.(…)`).

---

## Fuera de alcance técnico

- **CSP estricto con nonces**: incompatible con el bundler actual (Vite + injection runtime). Mitigado con CSP relajado + COOP/CORP/X-Frame.
- **Rate limiting custom**: delegado a Cloudflare WAF / Vercel firewall a nivel edge.
- **PCI-DSS**: cubierto por Stripe Checkout (no procesamos tarjetas en el dominio).
