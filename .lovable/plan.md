Entendido. El problema central no es solo un número del calendario: es que con la imagen de fondo azul cualquier texto/icono suelto que use `text-muted-foreground`, `text-foreground`, `bg-muted/50`, bordes suaves o botones ghost puede quedar con bajo contraste. Voy a corregirlo con una lógica única, no con parches aislados.

Plan de implementación:

1. Arreglar `/doctor/availability` de forma directa
   - Rehacer el contraste del `CalendarGrid` usado en disponibilidad.
   - Los números de los días serán visibles siempre:
     - días del mes: blanco/alto contraste sobre el fondo azul.
     - día actual: círculo azul claro/blanco con texto que contraste.
     - días fuera del mes: visibles pero atenuados, no casi invisibles.
   - Los nombres de días, horas, líneas y celdas usarán colores pensados para fondo oscuro.
   - La grilla tendrá un contenedor semitransparente oscuro o “glass” para que la imagen de fondo no compita con los números.
   - Los estados hover no bajarán el contraste.

2. Unificar la lógica visual de calendario en todas sus vistas
   - Mes, semana y día tendrán la misma regla:
     - texto principal visible.
     - texto secundario visible.
     - bordes visibles.
     - celdas con fondo sutil oscuro.
     - eventos con colores sólidos y texto blanco.
   - La barra de leyenda, toolbar, tabs y botones de navegación de `/doctor/availability` seguirán el mismo sistema de contraste.

3. Corregir el calendario pequeño del selector de fecha
   - El componente global `src/components/ui/calendar.tsx` recibirá clases más seguras para que DayPicker no muestre días casi invisibles.
   - En popovers/dialogs claros seguirá usando texto oscuro correcto.
   - Sobre fondos oscuros o transparentes, se evitarán `text-muted-foreground/50` demasiado tenues.

4. Crear utilidades globales de contraste para superficies sobre imagen
   - Agregar clases reutilizables en `src/index.css`, por ejemplo:
     - `.mm-dark-panel`: panel oscuro translúcido para contenido sobre imagen.
     - `.mm-dark-border`: borde visible sobre fondo azul.
     - `.mm-on-image-text`: texto principal blanco.
     - `.mm-on-image-muted`: texto secundario blanco con opacidad suficiente.
     - `.mm-on-image-control`: botón/control compacto, visible y consistente.
   - Aplicarlas primero donde está el fallo real: disponibilidad/calendarios.

5. Reforzar la “safety net” global sin romper cards/dialogs
   - Ajustar reglas de `.app-bg-image` para que textos e iconos sueltos dentro de `main` no queden azul oscuro sobre imagen azul.
   - Mantener la excepción para cards, dialogs y popovers claros, donde el texto debe seguir oscuro.
   - Añadir protección para fondos translúcidos claros (`bg-muted/50`, `bg-accent/20`, `bg-white/10`, etc.) para que nunca terminen con texto invisible.

6. Revisión visual obligatoria
   - Verificar `/doctor/availability` en el viewport actual aproximado `1106x736`.
   - Revisar vista mensual, semanal y diaria.
   - Abrir el modal de crear disponibilidad y revisar selector de fecha.
   - Confirmar que números, días, horas, iconos, tabs y botones se leen sin hover.
   - Hacer una revisión rápida de otros elementos sobre la imagen para que respeten la misma lógica global de contraste.

Archivos previstos:
- `src/components/availability/CalendarGrid.tsx`
- `src/pages/DoctorAvailability.tsx`
- `src/components/ui/calendar.tsx`
- `src/index.css`

No se requieren cambios de base de datos. Es una corrección visual/global de contraste.