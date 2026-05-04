## Mega-plan de seguridad — Medical Masters

Aplico TODO lo que es accionable desde el código/configuración. Lo que requiere abogado, pentest externo o infraestructura fuera de Lovable Cloud queda explícitamente fuera de alcance (al final).

---

### FASE 1 — Quick wins (sin UI nueva)

**1.1 Activar HIBP (Have I Been Pwned) en Auth**
- Activar `password_hibp_enabled: true` vía `configure_auth`.
- Bloquea contraseñas filtradas en signup y cambio de contraseña.

**1.2 Política de contraseñas robusta**
- Subir `password_min_length` a 12 (NIST SP 800-63B).
- Mantener requisitos actuales de complejidad.

**1.3 `/.well-known/security.txt`**
- Crear `public/.well-known/security.txt` con: contacto, política, idioma, expiración.
- Apuntar contacto a `seguridad@medical-masters.com` (o el que el usuario indique).

**1.4 Permissions-Policy + meta headers de seguridad complementarios**
- En `index.html` agregar `<meta http-equiv="Permissions-Policy">` limitando geolocation, payment, usb, etc. (cámara/micrófono se permiten en self para videoconsulta).
- Agregar `<meta name="referrer" content="strict-origin-when-cross-origin">`.

**1.5 Aviso de Privacidad LFPDPPP visible**
- Verificar `UnifiedFooter` y onboarding linkean a `/privacy`.
- Si falta link en onboarding/registro, agregarlo.
- Añadir mención explícita "Aviso de Privacidad" (no solo "Privacidad").

**1.6 Source maps off en producción**
- Confirmar `vite.config.ts`: añadir `build.sourcemap: false` explícito.

---

### FASE 2 — Página ARCO (LFPDPPP)

**2.1 Nueva página `/arco`**
- Formulario público para ejercer derechos de Acceso, Rectificación, Cancelación, Oposición.
- Campos: nombre, email, identificación adjunta, tipo de derecho, descripción.
- Validación con Zod (longitudes, sanitización).
- Inserta en nueva tabla `arco_requests` (RLS: solo admin puede leer; insert público con rate-limit lógico via UNIQUE(email, día)).
- Notifica por email al equipo via `send-verification-email` o nueva función `notify-arco-request`.

**2.2 Link en footer**
- Agregar "Derechos ARCO" en `UnifiedFooter` → `/arco`.

---

### FASE 3 — MFA (TOTP) opcional para todos, obligatorio para admins

**3.1 UI en `Settings`**
- Sección "Autenticación de dos factores".
- Enroll TOTP via `supabase.auth.mfa.enroll({ factorType: 'totp' })`.
- QR + verificación de 6 dígitos.
- Lista de factores activos + opción unenroll.

**3.2 Challenge en login**
- Tras `signInWithPassword`, si `currentLevel !== 'aal2'` y hay factor TOTP, mostrar paso de challenge.
- `supabase.auth.mfa.challenge` + `verify`.

**3.3 Enforcement para admins**
- Hook `useRequireMFA` que redirige a `/settings?mfa=required` si rol admin sin AAL2.
- Aplicar en `AdminDashboard` y rutas `/admin/*`.

**3.4 Banner sugerencia MFA para doctores**
- En `DoctorDashboard` mostrar banner dismissible si no tienen MFA (no obligatorio inicialmente, evita romper flujo).

---

### FASE 4 — Hardening de cabeceras y validaciones

**4.1 Validación Zod faltante en Edge Functions críticas**
- Auditar `create-consultation-checkout`, `create-chat-checkout`, `purchase-recording-wallet`, `claim-cedula`, `notify-new-chat`.
- Añadir `z.object({...}).safeParse` en cada handler que aún reciba `await req.json()` sin validar.

**4.2 Logs scrub**
- Revisar Edge Functions: ningún `console.log` debe imprimir contenido de mensajes de chat, contraseñas, tokens, ni datos clínicos.
- Reemplazar con `logger` o eliminar.

**4.3 SRI en scripts externos**
- gtag y Google Fonts en `index.html`: añadir `integrity` + `crossorigin` donde el proveedor lo soporte (fonts CSS sí; gtag no admite SRI por su naturaleza dinámica — documentar excepción en comentario).

**4.4 Eliminar leaks en errores**
- `NotFound.tsx` y páginas de error: confirmar que no muestran stack traces.

---

### FASE 5 — Subdominio y DNS (instrucciones al usuario, no código)

Documentar en un nuevo `SECURITY.md`:
- Cómo agregar registros CAA en su registrador.
- Cómo activar DNSSEC.
- Cómo verificar HSTS preload (https://hstspreload.org).
- Cómo activar Cloudflare WAF y Bot Fight Mode.
- Cómo correr `securityheaders.com` y `ssllabs.com` para auditar.

---

### Detalles técnicos

**DB migration nueva** (`arco_requests`):
```sql
create table public.arco_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(full_name) between 2 and 200),
  email text not null check (length(email) <= 255),
  request_type text not null check (request_type in ('access','rectification','cancellation','opposition')),
  description text not null check (length(description) between 10 and 5000),
  identification_url text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
alter table public.arco_requests enable row level security;
create policy "anyone can submit ARCO" on public.arco_requests for insert with check (true);
create policy "admins read ARCO" on public.arco_requests for select using (public.has_role(auth.uid(), 'admin'));
create policy "admins update ARCO" on public.arco_requests for update using (public.has_role(auth.uid(), 'admin'));
```

**security.txt**:
```
Contact: mailto:seguridad@medical-masters.com
Expires: 2027-01-01T00:00:00.000Z
Preferred-Languages: es, en
Canonical: https://medical-masters.com/.well-known/security.txt
Policy: https://medical-masters.com/security
```

**Permissions-Policy meta**:
```html
<meta http-equiv="Permissions-Policy" content="geolocation=(self), camera=(self), microphone=(self), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()">
```

---

### Fuera de alcance (requieren acción externa)

- **TLS, HSTS preload, CAA, DNSSEC**: configuración DNS / Cloudflare por el usuario.
- **CSP estricto con nonces**: incompatible con inyecciones runtime de Lovable; requiere mover a self-host.
- **NOM-024 / NOM-004 / COFEPRIS / HIPAA / ISO 27001**: certificación legal externa.
- **Pentest, bug bounty**: contratación externa.
- **Rate limiting custom**: política de Lovable Cloud (no hay primitivos aún).
- **WAF rules, SIEM, bastion hosts**: Cloudflare/infra del usuario.
- **PCI-DSS**: ya cubierto por Stripe Checkout (no procesamos tarjetas).

---

### Orden de ejecución una vez aprobado

1. Migración DB (`arco_requests`) + `configure_auth` (HIBP + min length 12).
2. Archivos estáticos: `security.txt`, meta tags en `index.html`, `vite.config.ts` sourcemap off.
3. Footer: link Aviso de Privacidad + ARCO.
4. Página `/arco` + ruta + Edge Function `notify-arco-request`.
5. UI MFA en Settings + challenge en Login + enforcement admins.
6. Validaciones Zod faltantes + scrub de logs en Edge Functions.
7. `SECURITY.md` con guía DNS/Cloudflare.

¿Apruebas para arrancar?
