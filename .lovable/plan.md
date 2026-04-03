

# Plan: Hospital Locator UX/UI + Material Médico + Verificación Final

## 3 bloques de trabajo

---

## 1. Hospital Locator — Rediseño completo UX/UI

**Estado actual:** Lista simple de 8 hospitales con nombre, dirección, teléfono y botones Waze/Google Maps. Sin imágenes, sin web, sin especialidades, sin mapa visual.

**Mejoras:**

### Datos expandidos por hospital (~20 hospitales reales de CDMX)
Cada hospital tendrá: nombre, dirección, teléfono, sitio web, especialidades destacadas, horario, nivel de atención (1er/2do/3er nivel), imagen de fachada (URL real del hospital), logo placeholder con iniciales estilizadas, y coordenadas reales.

### Rediseño UI
- **Hero banner** con gradiente azul/verde médico y contador de hospitales
- **Vista de tarjetas tipo grid** (2 columnas desktop, 1 móvil) con imagen de fachada en la parte superior de cada card
- **Cada card muestra:** imagen, badge de tipo (Público/Privado/Clínica), nombre, dirección, teléfono clickeable, sitio web con enlace externo, distancia calculada, especialidades como chips/badges, horario
- **Botones de navegación:** Google Maps y Waze con iconos estilizados
- **Filtro por zona/delegación** además de tipo
- **Vista de detalle expandible** al hacer click en la card (accordion o modal)
- Se usarán imágenes reales de hospitales mexicanos vía URLs públicas de sus sitios web

### Archivo: `src/pages/HospitalLocator.tsx` — reescritura completa

---

## 2. Material Médico — Marketplace solo para doctores

**Requerimiento de Fernanda:** "Agregar compra/venta de material, solo para médicos, que a pacientes no les salga."

### Implementación
- **Nueva página:** `src/pages/MedicalSupplies.tsx`
- **Acceso restringido:** Solo visible en nav para `roles: ['doctor', 'resident']` (NO pacientes)
- **Contenido:** Directorio/marketplace de material y equipo médico
  - Lista de categorías (instrumental quirúrgico, equipo diagnóstico, insumos, etc.)
  - Cards de productos con imagen, nombre, descripción, precio, proveedor
  - Botón "Solicitar info" o "Contactar proveedor"
  - Filtros por categoría y búsqueda
- **Datos iniciales:** Productos sample con proveedores mexicanos reales (referencias a marcas como Medline, 3M Health, BD, etc.)
- **Nav item:** Después de "Disponibilidad" en el menú lateral del doctor, con icono `Package`

### Archivos:
- Crear `src/pages/MedicalSupplies.tsx`
- Agregar ruta en `src/App.tsx`
- Agregar nav item en `src/components/layout/MainLayout.tsx` con `roles: ['doctor', 'resident']`
- Agregar i18n keys en `es.ts` y `en.ts`

---

## 3. Verificación final del listado completo del cliente

Basado en la revisión exhaustiva del código actual, confirmo el estado de cada punto:

| Punto | Estado |
|-------|--------|
| Suscripción pacientes a doctores | ✅ (followers + subscriptions) |
| Notificaciones de conexión del doctor | ✅ (email + push) |
| Idioma inglés/español | ✅ (LanguageContext) |
| Validación identidad facial | ✅ (Veriff) |
| Clasificación contenido por audiencia | ✅ (AudienceSelector) |
| Verificación automática de doctor (cédula SEP) | ✅ |
| Notificación por recargas/pagos | ✅ (send-purchase-email) |
| Modelo pagos tipo Uber/marketplace | ✅ (Stripe Connect) |
| Firma de documentos onboarding | ✅ (DocumentSignature) |
| Subida de facturas por doctor | ✅ (DoctorInvoices) |
| Lives freemium | ✅ |
| Expediente médico renombrado | ✅ |
| Seguridad expediente con OTP | ✅ |
| Formularios clínicos al registro | ✅ (ClinicalHistoryForm) |
| Chat tonos azules | ✅ |
| Almacenamiento tipo iCloud (Vault) | ✅ |
| Localiza tu médico/directorio | ✅ (Doctors.tsx) |
| Notificaciones por suscripción | ✅ |
| Métricas de Lives (viewers) | ✅ |
| Videollamada paciente-doctor | ✅ (Daily/WebRTC) |
| Disponibilidad del doctor toggle | ✅ |
| Perfil profesional doctor (CV) | ✅ |
| Bloqueo de pacientes | ✅ (BlockUserButton) |
| Categorías de documentos | ✅ |
| Cambio de moneda/divisa | ✅ (useCurrency) |
| Split de pagos | ✅ (Stripe Connect) |
| Facturación | ✅ |
| Terminología "Orientación médica" | ✅ |
| Noticias médicas | ✅ |
| Badges doctores | ✅ (DoctorBadge + ranks) |
| Residentes restricciones | ✅ |
| Meets médicos | ✅ (ClinicalSessions + meeting_type) |
| Reembolsos/disputas | ✅ (AdminRefunds) |
| Contenido Premium reordenado | ✅ |
| Precios ocultos en directorio | ✅ |
| Chat sin "1:1" | ✅ |
| Reuniones con tipo | ✅ |
| Especialidades completas (~35) | ✅ |
| Vacunas cartilla mexicana | ✅ |
| Enfermedades familiares ampliadas | ✅ |
| Medicamentos/cirugías dinámicos | ✅ |
| Localizar hospital | ✅ (se mejorará) |
| Masterclass en upload | ✅ |
| Cédula en Lives | ✅ |
| Chat modes (gratis/pago/mixto/suscriptores) | ✅ |
| Farmacéuticas/Material médico | ❌ → Se implementa ahora |
| Hospital Locator mejorado | ❌ → Se implementa ahora |

**Todo lo demás del listado está implementado. Solo faltan estos 2 puntos que se resuelven en este plan.**

