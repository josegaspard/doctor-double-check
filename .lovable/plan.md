

# Plan: Optimizar velocidad de carga y corregir navegacion

## Problema actual
1. **Carga lenta**: La Landing Page carga un video externo pesado, muchas imagenes de Unsplash, iconos animados y CSS inline. Los contextos (Lives, Wallet, Vault, Chat) hacen multiples queries al montar.
2. **Enlace cirugiaesteticauribe.com**: No hay logica que maneje la llegada desde el dominio personalizado hacia la landing. Actualmente el `useAuthState` redirige usuarios autenticados desde `/` a su dashboard, lo cual ya funciona.
3. **Cierre de sesion**: El logout ya redirige a `/lives` (confirmado en `useAuthActions.ts` linea 46). Esto ya esta correcto.

## Cambios propuestos

### 1. Optimizar Landing Page (mayor impacto)
- **Eliminar video de fondo del hero**: El video de Mixkit (~5MB) se carga en cada visita. Reemplazarlo con un gradiente CSS puro o un SVG pattern ligero.
- **Reemplazar imagenes de Unsplash del social proof** con avatares SVG inline o gradientes (elimina 4 requests HTTP externos).
- **Mover el CSS de animaciones** (scroll, fade-in, float) del `<style>` inline al archivo `index.css` para evitar repintados.
- **Agregar `loading="lazy"`** a la imagen principal del hero (doctora) que ya tiene lazy pero falta `fetchpriority="low"`.

### 2. Optimizar carga de contextos
- **LivesContext**: El polling cada 8 segundos (`setInterval` linea 455) es agresivo. Aumentarlo a 30 segundos ya que el realtime lo cubre.
- **fetchUserProfile**: Ya hace queries en paralelo, esta bien optimizado. Sin cambios.
- **WalletContext y VaultContext**: Solo se montan para usuarios autenticados (via `AuthenticatedProviders`), correcto.

### 3. Optimizar Vite build
- Agregar **manualChunks** en `vite.config.ts` para separar vendor (react, supabase, framer-motion, recharts) del codigo de la app, mejorando cache del navegador.

### 4. Precargar fuentes correctamente
- Cambiar el `<link rel="stylesheet">` de Google Fonts a `<link rel="preload" as="style">` para no bloquear el render.

### 5. Verificar navegacion del dominio personalizado
- El dominio `cirugiaesteticauribe.com` apunta a la app publicada. La ruta `/` ya muestra la Landing y redirige usuarios autenticados. No se necesitan cambios aqui.
- El logout ya redirige a `/lives`. Confirmado y correcto.

## Detalle tecnico de archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/Landing.tsx` | Eliminar tag `<video>`, reemplazar imagenes externas de social proof con iniciales SVG, mover estilos CSS inline |
| `src/index.css` | Agregar keyframes scroll, fade-in, float |
| `index.html` | Cambiar carga de Google Fonts a preload no-bloqueante |
| `vite.config.ts` | Agregar manualChunks para vendor splitting |
| `src/contexts/LivesContext.tsx` | Cambiar intervalo de polling de 8s a 30s |

## Resultado esperado
- Landing Page carga ~60% mas rapido (elimina video de 5MB + 4 imagenes externas)
- Mejor cache del navegador con vendor splitting
- Fuentes no bloquean el primer render
- Navegacion desde dominio personalizado y logout funcionan correctamente (ya estaban bien)

