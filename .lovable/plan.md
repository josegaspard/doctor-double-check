

# Rediseño de Comentarios estilo Instagram/Threads

## Problema
La sección de comentarios actual tiene un diseño básico con poco atractivo visual. Necesita un rediseño completo inspirado en Instagram/Threads: limpio, compacto, con interacciones modernas.

## Cambios en `src/pages/NewsArticle.tsx`

### Visual del comentario individual
- **Layout Instagram**: Avatar + nombre en línea + tiempo relativo ("hace 2h") en vez de fecha completa
- **Contenido inline**: El texto va justo debajo del nombre, sin card ni bordes
- **Acciones inline**: "Responder" y "Me gusta" como texto pequeño debajo del comentario (estilo IG)
- **Hilos**: Las respuestas usan una línea vertical delgada conectora desde el avatar padre, no `border-l` genérico
- **Respuestas colapsadas**: "Ver X respuestas" como texto clickeable azul (estilo Threads)

### Likes en comentarios (nueva funcionalidad)
- Añadir tabla `news_comment_likes` (user_id, comment_id) con RLS
- Icono de corazón al lado de cada comentario, relleno si ya le diste like
- Contador de likes visible

### Input de nuevo comentario
- **Estilo Instagram**: Input fijo al fondo de la sección con avatar del usuario, campo inline con placeholder "Añade un comentario..." y botón "Publicar" que aparece solo cuando hay texto
- Sin `Textarea` con bordes gruesos — usar un input limpio con borde sutil

### Tiempo relativo
- Usar `formatDistanceToNow` de date-fns en vez de fecha completa (ej: "hace 5 min", "hace 2h", "hace 3d")

### Reply UX
- Al hacer clic en "Responder", el input principal se enfoca con `@nombre` prefijado
- Las respuestas anidadas muestran "Respondiendo a @nombre" como texto sutil

### Empty state
- Icono de burbuja de chat con "Sé el primero en comentar" más estilizado

## Migración de base de datos
```sql
CREATE TABLE public.news_comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment_id uuid NOT NULL REFERENCES public.news_comments(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, comment_id)
);
ALTER TABLE public.news_comment_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can like" ON public.news_comment_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike" ON public.news_comment_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Anyone can read likes" ON public.news_comment_likes FOR SELECT USING (true);
```

## Archivos a modificar
- **`src/pages/NewsArticle.tsx`** — Rediseño completo de la sección de comentarios (líneas 197-583)

## Resumen visual

```text
┌─────────────────────────────────────┐
│ 🗨 Comentarios (12)                 │
├─────────────────────────────────────┤
│ [avatar] nombre · hace 2h          │
│ Excelente artículo, muy informativo │
│ ♡ 3   Responder                     │
│                                     │
│   [avatar] dr.perez · hace 1h      │
│   @nombre Gracias por tu comentario │
│   ♡ 1   Responder                   │
│                                     │
│ ── Ver 4 respuestas más ──          │
│                                     │
│ [avatar] maria · hace 30 min       │
│ ¿Dónde puedo encontrar más info?   │
│ ♡ 0   Responder                     │
├─────────────────────────────────────┤
│ [avatar] Añade un comentario...  ▸  │
└─────────────────────────────────────┘
```

