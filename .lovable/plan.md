

# Auditoría Final Completa — Estado vs Requisitos del Drive

## Resultado: ~97% implementado. Gaps restantes identificados abajo.

---

## Gaps Funcionales Encontrados

### Gap 1: Residentes NO tienen acceso al Chat en la navegación
**Archivo:** `src/components/layout/MainLayout.tsx` línea 85
- `navItems` para chat tiene `roles: ['patient', 'doctor']` — falta `'resident'`
- Bottom tabs para resident (líneas 140-145) tampoco incluyen Chat
- **Impacto:** Residentes no pueden acceder a `/chat` desde la navegación, aunque la lógica del chat (filtro, conexiones) ya está implementada

**Fix:** Agregar `'resident'` al array de roles del nav item de chat, y agregar Chat en los bottom tabs de resident

### Gap 2: Residentes NO tienen "Historia Clínica Propia" en nav
El requisito dice: *"historia clínica propia → solicitar orientación médica → lista de doctores"*
- `navItems` línea 88: `medicalRecord` solo tiene `roles: ['patient']`
- Residentes deberían poder tener su propio expediente médico

**Fix:** Agregar `'resident'` al nav item de `medicalRecord`

### Gap 3: Terminología "Consulta" → "Orientación Médica"
El cliente pidió explícitamente: *"Reemplazar palabra 'Consulta' → 'Orientación médica'"*
- Los archivos i18n (`es.ts`) probablemente siguen usando "Consulta" en muchos lugares
- Esto es un cambio de i18n, no de lógica

**Fix:** Revisar y actualizar las claves i18n relevantes en `es.ts` para usar "Orientación médica" en vez de "Consulta"

---

## Verificación de Items Completados (✅ = OK)

| Requisito | Estado |
|-----------|--------|
| Suscripción pacientes a doctores | ✅ `useSubscriptions`, `SubscribeButton` |
| Notificaciones de conexión del doctor | ✅ `send-live-notification-email`, `send-availability-reminders` |
| Idioma inglés/español | ✅ `LanguageContext`, `LanguageSwitcher`, `es.ts`/`en.ts` |
| Validación identidad facial | ✅ Veriff integration |
| Clasificación contenido (audiencia) | ✅ `AudienceSelector` |
| Verificación cédula automática | ✅ `verify-cedula-sep`, `claim-cedula` |
| Notificación por recargas/pagos | ✅ `send-purchase-email` |
| Modelo pagos tipo Uber | ✅ Stripe Connect, splits, `process-doctor-payouts` |
| Onboarding: firma + datos pago | ✅ `DocumentSignature`, `DoctorBankAccount` |
| Subida facturas doctor | ✅ `DoctorInvoices`, `AdminInvoiceReview` |
| Lives gratuitos + paywall premium | ✅ `AccessGuard`, `PaywallModal` |
| Expediente médico renombrado | ✅ Tab "Expediente Médico" |
| Seguridad expediente (OTP) | ✅ `OtpContext`, `expediente_otp` table |
| Formulario clínico en registro | ✅ `ClinicalHistoryForm` en onboarding |
| Almacenamiento tipo iCloud | ✅ `storage_used_bytes`/`storage_limit_bytes` |
| Directorio "Localiza tu médico" | ✅ `/doctors` con filtros geo/especialidad |
| Emergencia/911 | ✅ `/emergency` |
| Notificaciones por suscripción | ✅ Push + email notifications |
| Métricas de lives | ✅ `viewer_count`, `DoctorAnalytics` |
| Videollamada paciente-doctor | ✅ Daily integration, `/video-call` |
| Disponibilidad doctor (toggle) | ✅ `DoctorAvailability`, office hours |
| Perfil profesional (CV) | ✅ `DoctorCredentials`, education/certifications |
| Bloqueo de usuarios | ✅ `BlockUserButton` |
| Categorías documentos | ✅ Radiografías, laboratorios, etc. |
| Cambio país/moneda | ✅ `useCurrency`, `PriceDisplay` |
| Split de pagos | ✅ `payout_settings`, comisiones |
| Facturación | ✅ `DoctorInvoices` |
| Badges doctores | ✅ `DoctorBadge`, `doctor_ranks` |
| Residentes: chat con doctores | ✅ (lógica OK, falta nav — Gap 1) |
| Residentes: no cobran | ✅ Restringido en código |
| Meets médicos | ✅ `/meetings`, `MeetingCreateDialog` |
| Buscador en chat | ✅ `ChatSessionsList` con búsqueda |
| Chat pago separado de consulta | ✅ `create-chat-checkout` vs `create-consultation-checkout` |
| Límite chats en live | ✅ Lógica en `LiveChat` |
| Doctor bloquea chat en live | ✅ `chatMode` toggle |
| Contenido premium (grabaciones + presentaciones) | ✅ `RecordingsGrid`, `ContentGallery` |
| Psicología/Nutrición | ✅ `/psychology`, `/nutrition` |
| Geolocalización avanzada | ✅ Continente/País/Ciudad + "Cerca de mí" |
| Filtros universidad/hospital | ✅ `doctor_education` filter |
| Resumen post-consulta | ✅ `PostConsultationSummaryDialog`, `ConsultationSummaryCard` |
| Chat dos ventanas | ✅ Pacientes/Doctores tabs |
| Conexión residente-doctor | ✅ `doctor_resident_connections` |
| Reembolsos | ✅ `AdminRefunds`, `refund_requests` |
| Calculadoras de salud | ✅ `HealthCalculators` |
| Recetas | ✅ `Prescriptions`, `PrescriptionForm` |
| Noticias médicas | ✅ `MedicalNews`, `NewsFeed` |
| Wallet | ✅ Completa con top-up, historial |

---

## Plan de Correcciones (3 gaps)

### 1. `src/components/layout/MainLayout.tsx`
- Línea 85: Agregar `'resident'` a roles del chat nav → `roles: ['patient', 'doctor', 'resident']`
- Línea 88: Agregar `'resident'` a roles del medicalRecord nav → `roles: ['patient', 'resident']`
- Líneas 140-145: Agregar Chat a los bottom tabs de resident (reemplazar uno de los tabs actuales)

### 2. `src/lib/i18n/es.ts`
- Buscar y reemplazar instancias de "Consulta" → "Orientación médica" en las claves orientadas al usuario (labels de botones, títulos, toasts)
- Mantener "consulta" en contextos internos/técnicos donde no es visible al usuario

### 3. `src/lib/i18n/en.ts`
- Correspondiente: "Consultation" → "Medical Guidance" donde aplique

**No se requieren migraciones de DB ni cambios de lógica backend.**

