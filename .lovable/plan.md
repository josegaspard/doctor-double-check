

# Plan: Limpiar Cloudflare y arreglar sidebar sticky en Doctores

## 1. Eliminar funciones backend de Cloudflare no usadas

El proyecto usa Daily.co para lives/videocalls. Los archivos de Cloudflare backend generan alertas de seguridad innecesarias.

**Archivos a eliminar:**
- `supabase/functions/cloudflare-webhook/index.ts`
- `supabase/functions/cloudflare-debug/index.ts`
- `supabase/functions/cloudflare-whip/index.ts`
- `supabase/functions/create-cloudflare-stream/index.ts`
- `supabase/functions/end-cloudflare-stream/index.ts`
- `supabase/functions/get-cloudflare-playback/index.ts`
- `supabase/functions/setup-cloudflare-webhook/index.ts`

**No se eliminan** (aun los usan componentes del frontend):
- `src/hooks/cloudflare/useLocalRecording.ts` — usado por `DoctorGoLive.tsx` para grabación local
- `src/components/recordings/CloudflareRecordingPlayer.tsx` — usado por `RecordingVideoPlayer.tsx`
- `src/hooks/cloudflare/useCloudflareStream.ts` — tiene helpers de codec usados por `useCloudflareWebRTC.ts`

Los hooks del frontend no generan alertas de seguridad; solo las edge functions sí. Si en el futuro quieres limpiar los hooks del frontend también, se puede hacer por separado.

## 2. Arreglar sidebar sticky en Doctors.tsx

**Causa raíz:** El `<main>` en `MainLayout.tsx` (línea 488) tiene `overflow-x-hidden`, lo que crea un nuevo contexto de scroll y rompe `position: sticky` en los hijos.

**Solución en `src/components/layout/MainLayout.tsx`:**
- Cambiar `overflow-x-hidden` por `overflow-x-clip` en el `<main>` (línea 488)
- `overflow-x-clip` previene scroll horizontal igual que `hidden`, pero **no** crea un nuevo contenedor de scroll, así que `sticky` sigue funcionando

**Resultado:** La barra lateral de filtros en `/doctors` se mantendrá visible y fija al hacer scroll hacia abajo, tanto en desktop como en tablet.

## Archivos a modificar
1. `src/components/layout/MainLayout.tsx` — cambiar `overflow-x-hidden` → `overflow-x-clip`

## Archivos a eliminar
7 edge functions de Cloudflare (listadas arriba)

