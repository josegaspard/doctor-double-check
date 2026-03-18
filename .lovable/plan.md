
Objetivo: corregir de verdad el sticky del directorio, mejorar navegación horizontal de “Doctores disponibles ahora” en tablet/PC, resaltar comentarios destacados dentro del chat de grabaciones y hacer una pasada fuerte de responsive/mobile en footer, facturas y paneles internos de admin.

1. Doctores disponibles ahora: desktop/tablet con navegación visible
- En `src/pages/Doctors.tsx`, convertir el carrusel horizontal del bloque “Doctores Disponibles Ahora” en una fila con controles visibles en `md+`.
- Mantener el scroll táctil en móvil, pero en tablet/desktop añadir:
  - flecha izquierda/derecha
  - scroll por “página” o por tarjetas
  - indicador de que existen más doctores
- Ajustar ancho mínimo de tarjetas y padding para que no parezca cortado ni escondido.

2. Sidebar de especialidades: sticky real
- Reestructurar `src/pages/Doctors.tsx` para que el sidebar viva en un layout de grid estable en `md+`, en lugar de depender del flex actual que lo está rompiendo.
- Mantener el `aside` con `sticky top-24 self-start`, pero mover/ajustar wrappers que hoy le impiden deslizarse correctamente.
- Revisar cualquier contenedor con `overflow-hidden` o restricciones de altura alrededor del contenido principal para que el sticky responda al scroll de página y no quede “pegado mal”.
- Conservar scroll interno del sidebar solo para la lista de filtros cuando sea más alta que la ventana.

3. Chat de grabaciones: comentarios destacados dentro de la lista
- En `src/components/recordings/RecordingChatReplay.tsx`, traer también `is_paid` y `highlight_until` desde `live_chat_messages`.
- Mostrar mensajes destacados con tratamiento visual distinto dentro del mismo flujo:
  - fondo diferente
  - borde/acento premium
  - badge tipo “Destacado”
  - mejor contraste
- No anclarlos arriba ni separarlos en bloque especial; deben verse como parte natural de la conversación.
- Mantener tamaños y espaciados responsivos para que el chat siga viéndose bien en mobile.

4. Footer mobile: badges y composición
- En `src/components/layout/UnifiedFooter.tsx`, rehacer la composición mobile de:
  - badges App Store / Google Play
  - badge “All Systems Operational”
  - columnas de links
- Mejorar alineación, espaciado, tamaños de texto y proporciones de los badges para que no se vean “raros” ni aplastados.
- Hacer que en móvil la jerarquía sea más limpia: marca → texto → redes → badges stores → links → estado.

5. Tipografía y títulos mobile en páginas internas
- Hacer una pasada de responsividad de texto en encabezados y subtítulos para evitar cortes como los que ya se ven en screenshots.
- Aplicar una regla consistente:
  - títulos principales con mejor escalado móvil
  - subtítulos con ancho/leading correcto
  - chips, badges y tabs con texto más compacto
- Prioridad en páginas internas con más densidad visual.

6. Facturas y Pagos: mobile-first real
- En `src/pages/DoctorInvoices.tsx`, mejorar:
  - header y subtítulo para que no se amontonen
  - CTA “Subir Factura” para que respire mejor en celular
  - cards de resumen para que no queden cortadas
  - tabs y tarjetas de facturas/pagos con mejor stacking, paddings y tamaños de fuente
- Revisar especialmente los bloques informativos y el acordeón para que todo sea legible sin saturar ancho.

7. Panel de administración: mejora mobile en todas las internas
- Hacer una pasada consistente en páginas admin principales:
  - `src/pages/AdminDashboard.tsx`
  - `src/pages/AdminDoctors.tsx`
  - `src/pages/AdminResidents.tsx`
  - `src/pages/AdminUsers.tsx`
  - `src/pages/AdminReports.tsx`
  - `src/pages/AdminInvoiceReview.tsx`
  - `src/pages/AdminAnalytics.tsx`
  - y el resto de pantallas `/admin/*` que compartan patrones parecidos
- Mejoras a aplicar:
  - headers más compactos y legibles
  - filtros apilados correctamente
  - botones de acción que no se salgan ni empujen contenido
  - cards con metadata en columnas móviles
  - badges más pequeños y estables
  - tablas complejas convertidas en experiencia card-first cuando haga falta
- Tomaré como referencia directa el problema visible en “Gestión de Médicos” y replicaré esa limpieza visual al resto del admin.

8. Enfoque de implementación
- No hace falta backend nuevo; es trabajo de layout, responsive y presentación.
- Priorizaré reutilizar patrones existentes del proyecto:
  - cards mobile-first
  - badges compactos
  - grids que pasan a stack en móvil
  - controles horizontales solo donde realmente ayudan
- Si veo repetición fuerte entre páginas admin, propondré consolidar estilos/patrones compartidos para no seguir corrigiendo pantalla por pantalla de forma inconsistente.

Archivos principales a tocar
- `src/pages/Doctors.tsx`
- `src/components/recordings/RecordingChatReplay.tsx`
- `src/components/layout/UnifiedFooter.tsx`
- `src/pages/DoctorInvoices.tsx`
- `src/pages/AdminDashboard.tsx`
- `src/pages/AdminDoctors.tsx`
- `src/pages/AdminResidents.tsx`
- `src/pages/AdminUsers.tsx`
- `src/pages/AdminReports.tsx`
- `src/pages/AdminInvoiceReview.tsx`
- `src/pages/AdminAnalytics.tsx`

Resultado esperado
- En tablet/PC se verá claramente que hay más doctores disponibles y se podrán recorrer con flechas.
- La barra lateral de especialidades sí quedará sticky de verdad al bajar.
- En grabaciones, los comentarios destacados se distinguirán dentro del chat sin anclarse arriba.
- El footer mobile se verá limpio y proporcionado.
- “Facturas y Pagos” se verá ordenado y legible en celular.
- Las páginas internas del panel de administración dejarán de romperse en móvil y se sentirán consistentes, claras y utilizables.
