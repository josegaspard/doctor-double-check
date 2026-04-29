Entendido. Voy a corregirlo con una regla única de contraste, no con parches aislados.

Plan de implementación:

1. Corregir inmediatamente el link de “Olvidaste tu contraseña”
   - En `Login.tsx`, quitar `text-white` y `hover:text-white` del botón/link.
   - Dejarlo como link visible sobre tarjeta clara: azul primario, subrayado, hover azul más oscuro.
   - Asegurar que no quede afectado por las reglas globales de `.app-bg-image`.

2. Crear una lógica visual reutilizable para botones/chips sobre fondo azul
   - Agregar clases globales compactas y consistentes en `src/index.css`, por ejemplo:
     - botón/chip claro: fondo blanco o blanco translúcido + texto azul oscuro.
     - botón/chip activo: fondo azul primario + texto blanco.
     - botón secundario claro: fondo `#eef4ff` / blanco translúcido + texto azul oscuro, nunca texto blanco.
   - Ajustar la “safety net” global para que cualquier elemento con fondo claro (`bg-white`, `bg-background`, `bg-muted`, `bg-card`, `bg-accent`, `bg-light`, etc.) fuerce texto/iconos oscuros cuando esté fuera de cards/dialogs.
   - Evitar que botones claros terminen con blanco sobre blanco, incluyendo hover.

3. Arreglar `/hospital-locator` según las capturas
   - Cambiar los chips de tipo hospital y los badges del hero para que no usen fondo gris claro con texto blanco.
   - Aplicar la misma lógica a:
     - “Todos / Público / Privado / Clínica”
     - “20 hospitales / Información verificada / Ubicación activa / doctores activos”
     - filtros laterales y filtros mobile donde haya fondos claros/translúcidos.
   - Mantener colores de hospital coherentes:
     - Público: azul
     - Privado: morado
     - Clínica: teal
   - Estado inactivo: claro/translúcido con texto azul oscuro legible.
   - Estado activo: color fuerte con texto blanco.

4. Añadir doctores “por completo” dentro de `/hospital-locator`
   - Reemplazar el componente actual `HospitalDoctorsList` para que sea más completo y se parezca más a una lista real, no solo mini filas.
   - Mostrar dentro del hospital expandido:
     - avatar/iniciales
     - nombre
     - especialidad
     - rating
     - consultas
     - ubicación si existe
     - estado disponible/no disponible si los horarios existen
     - botón “Ver perfil”
   - Usar la ruta correcta de perfil médico (`/doctor/:id`) para alinearlo con el directorio actual.
   - Mejorar la consulta de datos para traer más campos de `doctor_profiles` y `profiles`.
   - Mantener fallback: si no hay doctores por especialidad, mostrar doctores aprobados top-rated y un botón al directorio completo.

5. Unificar onboarding y register con la misma lógica visual
   - En `Onboarding.tsx`, aplicar el mismo sistema a:
     - selector de rol
     - círculos de progreso
     - botones outline/ghost
     - botón de ubicación
     - botón de enviar/verificar teléfono
     - tarjetas/paneles informativos
   - En la pestaña register dentro de `Login.tsx`, asegurar que botones, separadores y Google button tengan contraste correcto y no dependan de texto blanco sobre fondos claros.
   - Mantener tamaños razonables; no agrandar botones ni header.

6. Revisión visual posterior
   - Revisar en la preview al menos:
     - `/login` pestaña login y register
     - `/onboarding`
     - `/hospital-locator` desktop al ancho actual 1106x736
     - un hospital expandido con doctores
   - Verificar específicamente:
     - no haya texto blanco sobre fondos claros
     - iconos visibles sin hover
     - botones activos/inactivos consistentes
     - chips no gigantes
     - doctores dentro de hospitales se ven como una lista completa y usable

Archivos previstos:
- `src/pages/Login.tsx`
- `src/pages/Onboarding.tsx`
- `src/pages/HospitalLocator.tsx`
- `src/components/hospitals/HospitalDoctorsList.tsx`
- `src/index.css`

No haré cambios de base de datos para esto; es UI y consulta de datos ya existentes.