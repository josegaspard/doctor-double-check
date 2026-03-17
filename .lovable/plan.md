

# Plan: Cambiar el logo de Google OAuth a Medical Masters

## Problema

La pantalla de "Selecciona una cuenta" de Google muestra el logo de Lovable porque el proyecto usa las credenciales OAuth gestionadas por Lovable Cloud. Ese logo se configura en la consola de Google Cloud, no en el código.

## Sobre el flujo de onboarding con Google

El código actual en `Login.tsx` ya maneja esto correctamente:
- `resolvePostLoginRoute()` verifica `onboarding_completed` en la tabla `profiles`
- Si es `false` (usuario nuevo), redirige a `/onboarding`
- El onboarding incluye el flujo biométrico de Veriff para roles que lo requieren

No se necesitan cambios de código para esto.

## Solución para el logo

Para mostrar el logo de Medical Masters en la pantalla de Google, necesitas usar **tus propias credenciales de Google OAuth** (en lugar de las gestionadas por Lovable). Pasos:

### 1. Crear credenciales en Google Cloud Console
1. Ir a [Google Cloud Console](https://console.cloud.google.com)
2. Crear o seleccionar un proyecto
3. En **Pantalla de consentimiento OAuth**: subir el logo de Medical Masters, configurar el nombre de la app como "Medical Masters"
4. En **Credenciales**: crear un "ID de cliente OAuth 2.0" tipo "Aplicación web"
5. En **URLs de redirección autorizadas**, agregar la URL de callback del backend
6. Copiar el Client ID y Client Secret

### 2. Configurar en Lovable Cloud
Abrir el backend y en Usuarios → Configuración de Autenticación → Métodos de Inicio de Sesión → Google, ingresar el Client ID y Client Secret propios.

### Archivos a modificar
Ninguno. Es configuración externa (Google Cloud Console + backend de Lovable Cloud).

