

# Plan: Corregir verificación biométrica, optimizar UI móvil y preparar app nativa

## 1. Corregir popup bloqueado de Veriff (problema principal)

**Causa**: En línea 121 de `IdentityVerification.tsx`, se usa `window.open(url, '_blank')` que los navegadores móviles bloquean como popup.

**Solución**: Reemplazar con `window.location.href = data.session_url` para navegación directa en la misma pestaña. Veriff redirigirá de vuelta a la `callback_url` al terminar. Esto es compatible con mobile browsers y WebViews de Capacitor.

```typescript
// Antes (bloqueado)
window.open(data.session_url, '_blank', 'noopener,noreferrer');

// Después (funciona en móvil)
window.location.href = data.session_url;
```

## 2. Optimizar UI móvil de la página de verificación

Según la screenshot, los badges "Pendiente" y "Veriff" se desbordan en móvil. Cambios:
- Hacer el layout del status card responsive: en móvil, badges debajo del título en vez de inline
- Reducir padding y tamaños de iconos en pantallas pequeñas
- Botones con `min-h-[44px]` para touch targets
- Texto y badges con `flex-wrap` para evitar overflow

## 3. Lógica de verificaciones y rangos

- La verificación biométrica (Veriff) confirma la **identidad de la persona** (cara + documento)
- La verificación de estudios/cédula ya funciona por separado (admin + API SEP)
- Los **rangos son solo para doctores** - se calculan por consultas, ingresos y calificación en `useDoctorRanks.ts`
- Agregar que tener `is_identity_verified = true` mejore el peso para el cálculo de rango (bonus en la función `calculateDoctorRank`)
- Para residentes, la verificación biométrica es opcional pero recomendada para seguridad

## 4. Compliance para App Store y Play Store

### Ya existente:
- `capacitor.config.ts` configurado
- `manifest.json` con iconos 192x192 y 512x512
- `SplashScreen.tsx` con splash animado
- `index.html` con meta tags

### Faltante a agregar:
- **`apple-mobile-web-app-capable`** y **`apple-mobile-web-app-status-bar-style`** meta tags en `index.html`
- **Iconos adicionales** en `manifest.json`: 72x72, 96x96, 128x128, 144x144, 152x152, 384x384 (referenciando los existentes con closest size)
- **`prefer_related_applications`** en manifest para native app
- **Privacy Policy y Terms URLs** ya existen en `/privacy` y `/terms` (requeridos por ambas stores)
- **`orientation`** ya está en manifest como `portrait-primary`

### No se puede generar desde Lovable (instrucciones para el usuario):
- Iconos en múltiples resoluciones reales (se explicará cómo generarlos)
- Certificados de signing para iOS/Android
- Archivos IPA/APK finales

## 5. Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/IdentityVerification.tsx` | Reemplazar `window.open` con `window.location.href`, responsive UI móvil |
| `src/hooks/useDoctorRanks.ts` | Agregar bonus de verificación biométrica al cálculo de rango |
| `index.html` | Agregar meta tags de Apple Web App |
| `public/manifest.json` | Agregar iconos adicionales y campos requeridos |

## 6. Instrucciones de exportación nativa

Después de los cambios, se proporcionarán instrucciones paso a paso para:
1. Export a GitHub
2. `npm install` + `npx cap add ios/android`
3. Generar iconos con herramientas como `capacitor-assets`
4. Build y sync
5. Ejecutar en emulador/dispositivo real

