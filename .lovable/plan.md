
# Plan: Screen Sharing + Auditoria Completa UX/UI + Revision de Procesos

## Parte 1: Compartir Pantalla en Videollamadas

### Problema actual
La funcion `renderVideoTracks` en `VideoCall.tsx` solo maneja `tracks.video` y `tracks.audio` del participante remoto. Cuando el doctor comparte pantalla, Daily.co expone el track en `tracks.screenVideo`, pero el codigo actual **lo ignora por completo**. El paciente nunca ve la pantalla compartida.

### Solucion
Modificar `renderVideoTracks` para detectar el track de screen share (`remote.tracks?.screenVideo?.persistentTrack`) y mostrarlo como el video principal (full-screen), moviendo el video de camara del remoto al PiP junto al local.

**Archivos a modificar:**
- `src/pages/VideoCall.tsx` -- Actualizar `renderVideoTracks` para manejar `screenVideo` y `screenAudio` tracks
- `src/components/videocall/VideoCallControls.tsx` -- Ocultar boton de compartir pantalla para pacientes en movil (no tiene sentido en iOS)

### Cambios tecnicos en renderVideoTracks:
1. Detectar `remote.tracks?.screenVideo?.persistentTrack`
2. Si existe screen share: renderizar screen share como video principal (`object-fit: contain` en vez de `cover`), y mover el video de camara remoto a un segundo PiP
3. Si no hay screen share: mantener el comportamiento actual
4. Agregar un indicador visual "Compartiendo pantalla" (badge superpuesto)

---

## Parte 2: Auditoria UX/UI Completa

Tras revisar todas las paginas y componentes, estos son los problemas encontrados:

### 2.1 Barra de navegacion inferior (Mobile Bottom Nav)
- **Indicador descentrado**: El indicador activo (`w-8 h-0.5`) esta posicionado con `left-1/2 -translate-x-1/2` en `top-0`, lo cual deberia estar centrado, pero visualmente puede verse desalineado si el contenido del tab no esta perfectamente centrado. Cambiar a un indicador mas ancho y visible, posicionado debajo del icono.
- **Tamano de area tactil**: Los tabs tienen `flex-1 h-full` pero el area clickeable real es limitada. Asegurar `min-h-[44px]` explicito.
- **Falta feedback haptico**: Agregar `active:scale-95` que ya esta pero verificar que funcione con la transicion.

### 2.2 Landing Page
- **Video de fondo en hero**: Usa un video externo de Mixkit que puede no cargar o ser lento. Agregar un fallback de gradiente si el video no carga.
- **Floating cards con `animate-bounce`**: Las tarjetas flotantes usan `animate-bounce` con duraciones largas que pueden ser molestas. Cambiar a una animacion mas sutil tipo `animate-float` (translacion vertical suave).
- **Logos del ticker "Mayo Clinic", "Johns Hopkins"**: Son nombres inventados/apropiados, podrian generar problemas legales. Recomendacion: cambiar a algo generico o eliminar.

### 2.3 Login/Registro
- **CardDescription duplica el label**: En la tab de Login, el `CardDescription` dice "Email" que es igual al label del campo. Cambiar a algo descriptivo como "Ingresa con tu cuenta".
- **Password strength en registro**: Funciona bien, pero no hay indicacion del minimo requerido antes de escribir.

### 2.4 Chat
- **Altura del contenedor**: Usa `h-[calc(100dvh-56px-72px)]` que es fragil y puede romperse si cambia la altura del header o la bottom nav.
- **Sin empty state animado**: Cuando no hay sesiones, el empty state es basico. Podria beneficiarse de una ilustracion o animacion.

### 2.5 Directorio de Doctores
- **Tarjeta de doctor clickeable + botones internos**: Ya usan `e.stopPropagation()` correctamente.
- **Filtro de especialidad**: El Select no tiene opcion de "limpiar filtro" visible (se debe seleccionar "Todas" manualmente).

### 2.6 Perfil de Usuario
- **Pagina muy larga**: Con 992 lineas, el perfil tiene demasiada informacion en una sola vista. Podria beneficiarse de tabs o secciones colapsables.

### 2.7 Videollamada
- **PiP local sin drag**: El video local (PiP) esta fijo en `bottom:80px;right:16px`. En moviles, puede tapar contenido. Idealmente deberia poder arrastrarse.
- **Sin indicador de "Doctor compartiendo pantalla"**: Ya mencionado arriba.

### 2.8 Notificaciones
- **Sin agrupacion por fecha**: Las notificaciones se muestran como lista plana sin separadores tipo "Hoy", "Ayer", "Esta semana".

### 2.9 Wallet
- **Montos predefinidos no adaptados a movil**: Los botones de monto `[100, 250, 500, 1000]` podrian verse apretados en pantallas muy pequenas.

### 2.10 General
- **Transiciones de pagina**: Usa `opacity: 0 -> 1` en 150ms que es correcto pero podria mejorarse con un fade + slide sutil.
- **Toast position**: En movil los toasts deberian estar en `top-center` (ya configurado segun memorias).
- **Dark mode**: El proyecto usa `next-themes` pero no parece tener toggle visible para dark mode en Settings.

---

## Parte 3: Revision de Procesos End-to-End

### Proceso 1: Registro -> Onboarding -> Uso
1. Landing -> RoleSelector -> Login (registro) -> Confirmacion email -> Login -> Onboarding
- **Problema**: Despues de confirmar email y hacer login, la redireccion va a `/lives` directamente (linea 118 de Login.tsx: `navigate('/lives')`), pero deberia ir a `/onboarding` si no ha completado el onboarding. La logica de `resolvePostLoginRoute` existe pero **solo se usa para Google login**, no para el login normal con email/password.

### Proceso 2: Paciente -> Consulta con Doctor
1. Buscar doctor -> Ver perfil -> Pagar consulta -> Chat se crea -> Videollamada
- **Completo y funcional** segun el codigo revisado.

### Proceso 3: Doctor -> Ir en Vivo
1. Dashboard -> Go Live -> Configurar -> Transmitir -> Finalizar
- **Funcional** segun los componentes existentes.

### Proceso 4: Doctor -> Verificacion de Identidad
1. Onboarding -> Subir cedula -> Verificacion automatica/manual -> Aprobacion
- **Funcional** con `CedulaAutoVerify` y `CedulaVerificationStatus`.

### Proceso 5: Videollamada
1. Chat -> Boton videollamada -> Doctor inicia -> Paciente recibe notificacion -> Ambos conectan
- **Problema ya corregido** con Daily.co, pero **falta screen share rendering** (Parte 1).

### Proceso 6: Prescripciones
1. Doctor -> Chat activo -> Crear prescripcion -> Paciente ve prescripcion
- **Funcional** con rutas `/prescriptions/new` y `/prescriptions/:id`.

### Proceso 7: Billetera / Pagos
1. Paciente -> Wallet -> Recargar -> Stripe checkout -> Regreso con exito -> Balance actualizado
- **Funcional** con polling de balance.

### Proceso 8: Login con email -- Redireccion post-login
- **BUG ENCONTRADO**: El `handleLogin` en Login.tsx siempre navega a `/lives` sin verificar si el onboarding esta completo o si el usuario es doctor. Deberia usar `resolvePostLoginRoute` igual que el flujo de Google.

---

## Resumen de implementacion

| Prioridad | Cambio | Archivo(s) |
|-----------|--------|------------|
| Alta | Screen share rendering en videollamadas | `VideoCall.tsx` |
| Alta | Fix redireccion post-login (usar resolvePostLoginRoute) | `Login.tsx` |
| Media | Mejorar indicador bottom nav (centrado y mas visible) | `MainLayout.tsx` |
| Media | Animaciones landing mas sutiles (float vs bounce) | `Landing.tsx` |
| Baja | Agrupar notificaciones por fecha | `Notifications.tsx` |
| Baja | Agregar toggle dark mode en Settings | `Settings.tsx` |
| Info | Logos de hospitales en landing (riesgo legal) | `Landing.tsx` |
