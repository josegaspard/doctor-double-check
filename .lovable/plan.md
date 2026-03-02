
# Plan: Optimizacion Completa Mobile UX/UI + Correcciones

## 1. Grabaciones del Doctor - Rediseno Mobile

**Problema**: La tabla de grabaciones usa columnas verticales ilegibles en movil (texto apilado verticalmente como se ve en las capturas).

**Solucion**: Reemplazar la tabla con tarjetas (cards) en movil usando `useIsMobile()`. Cada tarjeta mostrara:
- Titulo + tags en una linea
- Especialidad como badge horizontal (no vertical)
- Duracion, precio y compras en una fila compacta
- Menu de acciones (3 dots) en la esquina superior derecha

**Archivo**: `src/pages/DoctorRecordings.tsx`
- Detectar `isMobile` con el hook existente
- Renderizar cards en movil, tabla solo en desktop
- Stats summary cards: reducir texto grande `text-2xl` a `text-lg` en movil

## 2. Listado de Doctores - Espaciado entre badges

**Problema**: Los badges "Nuevo" y "Cardiologia" estan muy pegados visualmente.

**Solucion**: Agregar `gap-1.5` entre los badges y envolverlos en un contenedor flex con wrap.

**Archivo**: `src/pages/Doctors.tsx`
- Lineas ~309-313: Envolver `DoctorBadge` y el badge de especialidad en un `div` con `flex flex-wrap gap-1.5 mb-1.5`

## 3. Gestion de Noticias - Optimizar cards en movil

**Problema**: La card de noticias muestra imagen + titulo + botones en una fila que se aprieta en movil.

**Solucion**: En movil, apilar la card verticalmente: imagen arriba, contenido abajo, botones de accion como iconos en fila.

**Archivo**: `src/pages/AdminNews.tsx`
- Lineas ~358-398: Cambiar el layout de `flex items-center` a apilado en movil (`flex flex-col sm:flex-row`)
- Header de "Gestion de Noticias": hacer responsive el titulo y boton "Nueva noticia"

## 4. Rating del Doctor - Fix navegacion

**Problema**: Al hacer clic en "Rating" en el dashboard del doctor, navega a `/doctor/profile#reviews` que no existe correctamente.

**Solucion**: Cambiar la navegacion a `/doctor/{userId}` con un hash `#reviews` que apunte al perfil publico del doctor donde estan las resenas.

**Archivo**: `src/components/doctor/DoctorStatsGrid.tsx`
- Linea 48: Cambiar `navigate('/doctor/profile#reviews')` a `navigate(`/doctor/${user?.id}#reviews`)`

## 5. Orden de Chats - Mas reciente primero

**Problema**: Al pagar una nueva orientacion, la sesion nueva no aparece primera en la lista.

**Solucion**: El `fetchSessions` ya ordena por `last_message_at DESC`, pero las sesiones nuevas sin mensajes tienen `last_message_at = null` que van al final con `nullsFirst: false`. Cambiar a ordenar por `created_at DESC` como fallback.

**Archivo**: `src/contexts/ChatContext.tsx`
- Linea 93: Cambiar la query de ordenamiento para usar `created_at` como criterio secundario, o cambiar `nullsFirst` a `true` para que sesiones nuevas aparezcan primero

## 6. Doctor Live Mobile - Optimizacion completa

**Problema**: Cuando el doctor inicia live desde celular, la interfaz no esta completamente optimizada.

**Solucion**:
- **LiveStreamView mobile**: Ya tiene layout fullscreen, pero necesita:
  - Indicador LIVE pulsante visible (badge rojo)
  - Boton de voltear camara (front/back) para movil
  - Controles mas grandes y tactiles (min 44x44px)
  - Agregar boton de mute de audio y video en los controles inferiores
  - Safe area insets en el header overlay tambien

- **LiveSetupForm**: Optimizar formulario para movil:
  - Select de especialidad nativo en movil
  - Campos mas compactos
  - Boton "Iniciar" sticky en la parte inferior

**Archivos**:
- `src/components/live/LiveStreamView.tsx` - Mejorar controles moviles: agregar mute audio/video, flip camera, badge LIVE, controles mas grandes
- `src/components/live/LiveSetupForm.tsx` - Optimizar layout del formulario para movil
- `src/pages/DoctorGoLive.tsx` - Asegurar que MainLayout se oculte en modo live movil

## Resumen tecnico de cambios

| Archivo | Cambio |
|---------|--------|
| `src/pages/DoctorRecordings.tsx` | Cards en movil en vez de tabla |
| `src/pages/Doctors.tsx` | Espaciado entre badges |
| `src/pages/AdminNews.tsx` | Cards de noticias responsivas |
| `src/components/doctor/DoctorStatsGrid.tsx` | Fix navegacion Rating |
| `src/contexts/ChatContext.tsx` | Ordenar sesiones nuevas primero |
| `src/components/live/LiveStreamView.tsx` | Controles moviles completos para doctor |
| `src/components/live/LiveSetupForm.tsx` | Formulario optimizado movil |
