## Objetivo

Atender 6 ítems de UX/funcional + relación doctor↔hospital.

---

### 1. Re-login al cerrar todas las ventanas

Hoy la sesión persiste en `localStorage` (Supabase + `mm_cached_user`), por eso al volver el usuario sigue logueado.

**Cambio:** que la sesión muera al cerrar todas las pestañas (tipo "session-only").

- En `src/integrations/supabase/client.ts` (auto-generado) NO se puede tocar. Alternativa: en `src/main.tsx` o un nuevo `src/lib/sessionGuard.ts`, al boot detectar si es una "nueva sesión de navegador" usando `sessionStorage` (que sí muere al cerrar todas las pestañas) como flag. Si no existe el flag → ejecutar `supabase.auth.signOut()` antes de hidratar y limpiar `mm_cached_user`. Setear el flag inmediatamente después.
- Mantener excepción para visitantes (`medicalMasters_visitor` en sessionStorage) y para flujos OAuth en curso (no signOut si la URL trae `code=` / hash con `access_token`).
- Resultado: refrescar la pestaña no cierra sesión; cerrar todas sí.

### 2. Visibilidad de iconos y textos

- **`LanguageSwitcher`** (`src/components/settings/LanguageSwitcher.tsx`): el botón usa fondo `bg-white/12` solo en hover y en headers oscuros se pierde. Darle un fondo permanente sutil (`bg-white/10 border border-white/20`) cuando se renderiza sobre header oscuro (Login/Landing) y mantener variant claro dentro de MainLayout. En la captura se ve un cuadrado sólido — replicar ese contenedor blanco con icono primary cuando esté sobre fondo oscuro: `bg-white text-primary` opcional vía `variant`.
- **"¿Olvidaste tu contraseña?"** en `src/pages/Login.tsx` línea 264: cambiar `text-white/85` → `text-white underline-offset-4 hover:underline font-medium` para alto contraste (ya no se selecciona para verlo).
- **Icono perfil doctor (Stethoscope "Dr.")** en MainLayout: hoy es transparente con borde fino. Aplicar `bg-white/15 border-white/40 text-white` o un look píldora con fondo blanco-translúcido más visible.
- **Icono campana / búsqueda** del header: añadir `bg-white/10` permanente para que se note sin hover.

### 3. Renombrar "Acceso Vault"

`src/lib/i18n/es.ts` línea 229: `vaultAccess: 'Acceso Vault'` → `'Bóveda médica'` (y EN equivalente `'Medical vault'`). Verificar que es el único lugar en `/doctor/dashboard`.

### 4. Calendario legible

`src/components/ui/calendar.tsx`: los días aparecen casi invisibles sobre el fondo azul oscuro de la app porque el `day` hereda `text-muted-foreground` del ghost button. Cambios:
- `head_cell`: `text-muted-foreground` → `text-foreground/80 font-semibold`
- `day`: añadir `text-foreground` explícito; outside `opacity-50` → `opacity-40 text-foreground`
- `day_today`: ya tiene `bg-accent`, reforzar con `font-bold ring-1 ring-primary/30`
- Mejorar contraste de números no seleccionados con `text-foreground` en lugar de heredar.

### 5. Lista de doctores dentro de Hospitales

**Problema de datos:** `hospitals` no tiene relación con `profiles`. No existe columna `hospital_id` en doctores.

**Decisión:** mostrar doctores **filtrados por especialidad y zona del hospital** (mejor proxy disponible sin migración). Cuando el usuario expande un hospital, debajo de las reseñas mostrar un bloque "Doctores relacionados" con:
- Query a `profiles` donde `role='doctor'`, `verified=true`, especialidad ∈ `hospital.specialties`, limit 6.
- Card horizontal compacta (avatar, nombre, especialidad, rating, botón "Ver perfil").
- Link "Ver todos en /doctors?specialty=X" para ir al directorio completo.

Componente nuevo: `src/components/hospitals/HospitalDoctorsList.tsx`. Se inserta en `HospitalLocator.tsx` dentro del bloque expandido.

(Si el cliente luego quiere asociación real médico↔hospital, eso requiere migración futura `profiles.hospital_id` o tabla `doctor_hospitals` — fuera del alcance de esta iteración.)

### 6. Item activo del header con fondo blanco

`src/components/layout/MainLayout.tsx` línea 405-419: hoy el activo usa `text-primary` + pill `bg-primary/10`. Cambiar a:
- Activo: `bg-white text-primary` (la pill `motion.span` pasa a `bg-white shadow-sm`)
- No activo: queda igual.
- Aplicar también al panel doctor activo (variant blanca con borde primary).
- Mismo patrón en bottom-nav móvil (línea 564+) si aplica: activo con fondo blanco redondeado.

---

## Archivos a modificar / crear

- `src/main.tsx` o nuevo `src/lib/sessionGuard.ts` (re-login)
- `src/components/settings/LanguageSwitcher.tsx` (visibilidad)
- `src/pages/Login.tsx` (link "olvidaste contraseña")
- `src/components/layout/MainLayout.tsx` (icono Dr, activo blanco, campana/search)
- `src/lib/i18n/es.ts` + `en.ts` (renombrar vault)
- `src/components/ui/calendar.tsx` (contraste días)
- `src/components/hospitals/HospitalDoctorsList.tsx` (nuevo)
- `src/pages/HospitalLocator.tsx` (integrar lista doctores)

Sin migraciones. Sin nuevas dependencias.