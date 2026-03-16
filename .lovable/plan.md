

# Plan: Rotación de banners entre campañas y acceso al panel de anunciante para todos los roles

## Resumen

Actualmente, cuando hay múltiples campañas activas, el banner elige un creativo al azar **una sola vez** al montar el componente y no rota. El objetivo es que los banners roten automáticamente entre todas las campañas activas, y que cualquier usuario (doctor, residente, paciente) pueda acceder al panel de anunciante para ver sus métricas.

## Cambios

### 1. Rotación automática de banners (`src/hooks/useAds.ts`)

Modificar `useAdCreative` para implementar rotación temporizada:

- Después de seleccionar los creativos válidos, guardarlos todos en un array en lugar de solo uno
- Añadir un `setInterval` (cada 8-10 segundos) que rota al siguiente creativo del array
- Resetear el tracking de impresión al cambiar de creativo para que cada uno contabilice su propia impresión
- Limpiar el intervalo en el cleanup del `useEffect`

### 2. Seed de campañas demo (edge function `seed-demo-users`)

Actualizar `supabase/functions/seed-demo-users/index.ts` para insertar campañas demo asignadas a:

- `doctor1@medicalmasters.test` — campaña "Consultas de Cardiología"
- `residente1@medicalmasters.test` — campaña "Grupo de Estudio Residentes"
- `paciente1@medicalmasters.test` — campaña "Testimonio Paciente"

Cada campaña con status `active`, presupuesto de prueba, y creativos placeholder vinculados a placements existentes. Se usará el insert tool para insertar las campañas directamente en la base de datos.

### 3. Enlace al panel de anunciante en navegación para todos los roles

Verificar que el enlace a `/advertiser/dashboard` en `MainLayout.tsx` esté disponible para todos los roles autenticados (ya existe en el sheet "Más"). No se necesitan cambios de ruta — la ruta `/advertiser/dashboard` ya está registrada sin restricción de rol.

### Detalle técnico de la rotación

```text
useAdCreative(placementName)
  ├── Fetch todos los creativos válidos (filtrados por campaign status + role + language)
  ├── Guardar array completo en state: allCreatives[]
  ├── Estado actual: currentIndex (empieza random)
  ├── setInterval(8000ms) → currentIndex = (currentIndex + 1) % allCreatives.length
  ├── Cada cambio de index → trackImpression del nuevo creativo
  └── Cleanup: clearInterval
```

### Archivos a modificar

1. **`src/hooks/useAds.ts`** — Añadir rotación temporizada en `useAdCreative`
2. **`src/components/ads/AdBanner.tsx`** — Añadir transición suave al cambiar de creativo (fade)
3. **Inserción directa en BD** — Seed de 3 campañas demo con creativos para los usuarios mencionados

### Credenciales de prueba

Todos usan la contraseña `Demo1234!`:
- **Doctor**: doctor1@medicalmasters.test
- **Residente**: residente1@medicalmasters.test
- **Paciente**: paciente1@medicalmasters.test

Cada uno podrá acceder a `/advertiser/dashboard` para ver las métricas de su campaña.

