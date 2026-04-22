

# Plan: 5 mejoras finales — UI directorio, previews chat, badges credenciales, panel Vault audit

## 1. Tarjeta del doctor sin desbordes (PC/tablet/móvil)

**Archivo: `src/pages/Doctors.tsx`** — la card de doctor actualmente apila nombre + badges + especialidad horizontalmente. En tablets (768-1024px) y móviles los badges de credenciales (Céd. Prof., COFEPRIS, identidad verificada) hacen overflow.

Cambios concretos:
- Wrapper del header del doctor: pasar de `flex items-center gap-2` a `flex flex-wrap items-start gap-1.5 min-w-0` para permitir que los badges salten a una segunda línea si no caben.
- Nombre del doctor: agregar `truncate min-w-0 flex-shrink` para no empujar los badges fuera.
- Contenedor de badges: `flex flex-wrap gap-1 max-w-full` para que el grupo se reorganice.
- Especialidad y location: `line-clamp-1` en móvil, `line-clamp-2` en `sm:` y superiores.
- Precio: mover a su propio renglón debajo del nombre con `flex items-baseline justify-between` para que no compita con badges.

Aplicar también a:
- `src/components/doctor/DoctorProfileCard.tsx` (mismo patrón de wrap)
- `src/components/doctor/DoctorBadge.tsx` — reducir `gap-1` a `gap-0.5` y agregar `whitespace-nowrap shrink-0` en cada badge interno

## 2. Mostrar precio de consulta para TODOS los usuarios en `/doctors`

**Archivo: `src/pages/Doctors.tsx`**

Hoy hay un check tipo `if (role === 'patient' || role === 'resident')` que oculta el precio para visitantes y otros roles. Memoria registra que se ocultó en directorio público — el usuario explícitamente quiere revertir esto.

Cambios:
- Eliminar el condicional de visibilidad del precio en la card del directorio.
- Renderizar siempre `<PriceDisplay amount={doctor.consultation_fee} className="text-base font-semibold text-primary" />` con la moneda del usuario via `useCurrency()`.
- Agregar tooltip discreto "Precio orientativo. Pacientes y residentes pueden iniciar consulta. Visitantes deben crear cuenta." cuando el rol del visor no pueda comprar (visitante anónimo / doctor).
- Para `resident`: mantener cálculo del 50% off visual con tachado del precio original.

**Actualizar memoria**: marcar `mem://style/doctors-directory-layout-design` con la nueva regla "Precio visible siempre en directorio público".

## 3. Preview del último mensaje estilo redes sociales

**Archivo: `src/lib/utils.ts`** — ya existe `formatMessagePreview` con buena lógica. Verificar que se use en TODOS los lugares donde se renderiza el último mensaje.

**Auditar y corregir uso en**:
- `src/components/chat/ChatSessionItem.tsx` — preview en lista de chats
- `src/components/notifications/NotificationBell.tsx` — preview en notificaciones de mensaje nuevo
- `src/hooks/useNotifications.ts` (si renderiza preview)
- Cualquier badge "último mensaje" en `Chat.tsx`

Asegurar que **todos** llamen `formatMessagePreview(message.content, 60)` en lugar de mostrar `message.content` raw. Esto convierte:
- `📷 [Imagen: scan.jpg]` → `📷 Foto`
- `📎 [Archivo: estudio.pdf]` → `📎 estudio.pdf`
- `📋 ... /prescriptions/abc` → `📋 Receta médica`
- `🎥 [Video: ...]` → `🎥 Video`

Si algún caller muestra preview HTML, asegurar escape correcto antes del render.

## 4. UI verificación médica con estados completos (pending/approved/rejected + motivo COFEPRIS)

**Archivo nuevo: `src/components/doctor/CredentialStatusBadge.tsx`**

Componente unificado que recibe `{ type: 'cedula' | 'cofepris', status, value, rejectionReason }` y renderiza:

| Status | Color | Icono | Texto | Tooltip/Popover |
|--------|-------|-------|-------|-----------------|
| `approved` | success (verde) | ✓ ShieldCheck | "Céd. Prof." / "COFEPRIS" + valor | "Verificada por Medical Masters" |
| `pending` | warning (ámbar) | ⏳ Clock | "Céd. en revisión" / "COFEPRIS en revisión" | "Pendiente de revisión por el equipo" |
| `rejected` | destructive (rojo) | ✗ XCircle | "Céd. rechazada" / "COFEPRIS rechazado" | Popover con `rejectionReason` y botón "Resubir documento" si es el doctor mismo |

Usar `<Popover>` (no Tooltip) para soportar contenido rico en mobile (tap para abrir).

**Reemplazar instancias** en:
- `src/components/doctor/DoctorBadge.tsx`
- `src/components/doctor/DoctorProfileCard.tsx`
- `src/pages/DoctorProfile.tsx`
- `src/pages/Doctors.tsx`
- `src/pages/LivesGrid.tsx` (ya tiene rejection inline pero usar el componente unificado)
- `src/pages/UserProfile.tsx` para perfil del doctor logueado

**Para el doctor logueado en su perfil**: agregar sección con `<Alert variant="destructive">` si tiene credencial rechazada, mostrando:
- Razón completa (no truncada)
- Botón directo "Subir nuevo documento" → abre dialog de upload a `doctor-credentials` bucket
- Marca `cedula_status='pending'` o `cofepris_status='pending'` al re-subir y limpia `rejection_reason`

## 5. Panel de auditoría del Vault con filtros

**Archivo nuevo: `src/components/vault/VaultAuditPanel.tsx`**

Tabla con columnas:
- Fecha (formato `dd MMM yyyy HH:mm`)
- Acción (badge color-coded): `access_granted` (verde), `access_revoked` (ámbar), `access_denied` (rojo), `viewed` (azul), `downloaded` (azul), `uploaded` (gris)
- Archivo (nombre clickable que abre preview)
- Actor (nombre + avatar pequeño)
- Doctor (si aplica, desde `metadata.doctor_id`)

**Filtros** (en panel superior):
- Date range picker con presets: Hoy, 7 días, 30 días, Personalizado
- Select por archivo: dropdown con archivos del paciente/doctor actual
- Select por acción: multi-select de tipos
- Búsqueda libre por nombre de actor

**Datos**: query a `vault_audit_log` con joins:
```sql
SELECT val.*, vf.file_name, p_actor.name as actor_name, p_actor.avatar_url
FROM vault_audit_log val
LEFT JOIN vault_files vf ON vf.id = val.file_id
LEFT JOIN profiles p_actor ON p_actor.id = val.actor_id
WHERE val.patient_id = $current_user OR val.actor_id = $current_user
ORDER BY val.created_at DESC
LIMIT 100
```

**RLS**: la tabla ya tiene políticas que permiten al paciente ver eventos sobre sus archivos y al doctor ver eventos donde él es el actor — verificar y ajustar si falta.

**Realtime**: suscripción a INSERT en `vault_audit_log` filtrada por `patient_id=auth.uid()` para refrescar la tabla en vivo.

**Export CSV**: botón "Exportar CSV" que descarga los eventos visibles con filtros aplicados (reusa lógica de `lib/exportClinicalSummary.ts`).

**Integrar en**:
- `src/pages/Vault.tsx` — pestaña nueva "Auditoría" para el paciente
- `src/pages/DoctorVault.tsx` — pestaña "Mi actividad" para el doctor (filtra por `actor_id=auth.uid()`)

## Archivos tocados

**Nuevos:**
1. `src/components/doctor/CredentialStatusBadge.tsx`
2. `src/components/vault/VaultAuditPanel.tsx`

**Editados:**
3. `src/pages/Doctors.tsx` — wrap badges, mostrar precio universal
4. `src/components/doctor/DoctorProfileCard.tsx` — wrap layout, usar `CredentialStatusBadge`
5. `src/components/doctor/DoctorBadge.tsx` — usar `CredentialStatusBadge`, gap reducido
6. `src/pages/DoctorProfile.tsx` — usar `CredentialStatusBadge` + alert para rechazos del propio doctor
7. `src/pages/LivesGrid.tsx` — sustituir badges custom por `CredentialStatusBadge`
8. `src/pages/UserProfile.tsx` — alert con resubida si credencial rechazada
9. `src/components/chat/ChatSessionItem.tsx` — usar `formatMessagePreview` en último mensaje
10. `src/components/notifications/NotificationBell.tsx` — usar `formatMessagePreview`
11. `src/pages/Vault.tsx` — agregar pestaña "Auditoría" con `<VaultAuditPanel mode="patient" />`
12. `src/pages/DoctorVault.tsx` — agregar pestaña "Mi actividad" con `<VaultAuditPanel mode="doctor" />`
13. `mem://style/doctors-directory-layout-design` — actualizar regla de precio visible

**Sin migraciones SQL** — `vault_audit_log` ya existe con trigger `trg_vault_access_audit` activo.

## Resultado garantizado

- Cards de doctores fluyen correctamente en cualquier tamaño de pantalla; badges saltan de línea sin desbordes ni truncado feo.
- Precio del doctor visible para visitantes, pacientes, residentes y otros doctores en `/doctors`, con tooltip aclaratorio del descuento de residentes.
- Lista de chats y notificaciones muestran previews limpios estilo WhatsApp ("📷 Foto", "📋 Receta médica", "📎 estudio.pdf") en lugar de marcadores raw.
- Cada credencial (Cédula y COFEPRIS) muestra estado visual claro con color, ícono y popover con motivo de rechazo; doctor puede resubir documento directamente desde su perfil.
- Paciente y doctor cuentan con panel de auditoría del Vault con tabla filtrable por fecha/archivo/acción, refresh en vivo y export a CSV.

