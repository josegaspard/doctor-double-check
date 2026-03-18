

# Plan: Mejorar UX del formulario Go Live + Completar datos en Grabaciones

## Problema 1: LiveSetupForm — Usuarios no entienden qué hacer
- El thumbnail está escondido dentro de la sección de grabación, solo visible si "Grabar" está activo
- El área de subir imagen es un rectángulo gris con texto pequeño — no parece un botón
- El chat de pago está dentro de radio buttons técnicos que los doctores no entienden
- Las opciones "paid_only" y "mixed" son confusas para usuarios no técnicos

## Problema 2: DoctorRecordings — Faltan datos completos
- La tabla de grabaciones no muestra datos del live asociado (likes, chats de pago, revenue de chats)
- El stats dialog solo muestra compras de grabación, no el desglose completo
- "Ingresos" solo refleja ventas de video, no incluye ingresos por chats de pago del live original

## Cambios

### 1. `src/components/live/LiveSetupForm.tsx` — Rediseño UX completo

**Thumbnail:**
- Mover el thumbnail FUERA del condicional de grabación a la Sección 1 (junto a título/descripción)
- Renombrar a "Imagen de portada" con subtítulo "Esta imagen aparecerá cuando los espectadores vean tu live"
- Hacer el área de drop más grande y prominente con borde colorido, icono de cámara grande y texto "Toca aquí para subir tu imagen de portada"
- Agregar un botón explícito "Seleccionar imagen" dentro del área

**Chat de pago:**
- Reemplazar los radio buttons técnicos por cards visuales con iconos y descripciones claras:
  - Card 1: "Chat gratuito" — icono MessageSquare — "Todos pueden comentar gratis"
  - Card 2: "Chat con mensajes destacados" — icono Sparkles — "Los espectadores pueden pagar para que su mensaje se destaque. Tú defines el precio."
  - Card 3: "Solo chat de pago" — icono DollarSign — "Solo pueden comentar quienes paguen"
- Cada card es seleccionable con borde primary cuando está activa
- Cuando se selecciona una opción con pago, mostrar inmediatamente el campo de precio con placeholder "Ej: $20 MXN" y label grande "¿Cuánto cobrar por mensaje?"

**General:**
- Aumentar tamaños de fuente en labels y placeholders
- Hacer todos los campos más táctiles (min-h-12 en inputs)

### 2. `src/pages/DoctorRecordings.tsx` — Datos completos de grabaciones

**Fetch live data para grabaciones:**
- Cuando una grabación tiene `liveId`, buscar también los datos del live asociado: `peak_viewers`, `likes_count`, `paid_chats_count`, `chat_price`
- Buscar conteo de comentarios totales y de pago desde `live_chat_messages`
- Calcular `paidChatRevenue = paid_chats_count * chat_price`

**Stats summary cards (Grabaciones tab):**
- Agregar una 5ta card o cambiar "Ingresos" para mostrar ingresos TOTALES = ventas de grabación + chats de pago
- Debajo, mostrar el desglose: "Ventas video: $X | Chats de pago: $Y"

**Stats dialog (al ver estadísticas de una grabación):**
- Agregar sección con datos del live original:
  - Pico de espectadores
  - Likes totales
  - Comentarios totales / De pago
  - Ingresos por chats de pago
  - Ingresos por ventas de video
  - **Ingresos totales** (suma de ambos)

**Tabla/cards de grabaciones:**
- En desktop: agregar columna "Chats pago" con el conteo
- En mobile cards: agregar fila con likes y chats de pago
- La columna "Ingresos" ahora muestra el total combinado (ventas + chats)

### Archivos a modificar
1. `src/components/live/LiveSetupForm.tsx` — Rediseño UX thumbnail + chat modes
2. `src/pages/DoctorRecordings.tsx` — Fetch live stats, mostrar datos completos

