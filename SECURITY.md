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
- [ ] Auditoría de `console.log` en edge functions para evitar leak de PHI.
- [ ] SRI en scripts de Google Fonts.
- [ ] Tabla `arco_audit_log` para rastrear acciones admin sobre solicitudes ARCO.

---

## Fuera de alcance técnico

- **CSP estricto con nonces**: incompatible con el bundler actual (Vite + injection runtime). Mitigado con CSP relajado + COOP/CORP/X-Frame.
- **Rate limiting custom**: delegado a Cloudflare WAF / Vercel firewall a nivel edge.
- **PCI-DSS**: cubierto por Stripe Checkout (no procesamos tarjetas en el dominio).
