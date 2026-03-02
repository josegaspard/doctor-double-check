

# Plan: Paginacion de Noticias + Filtros Avanzados + UX/UI Optimizado

## Resumen

Implementar paginacion de 15 en 15 en la pagina de Noticias Medicas, aumentar el feed de la landing a 15 items con boton "Leer mas noticias", agregar filtros avanzados (mas leidos, mas comentados, recientes), y optimizar completamente el UX/UI en PC, tablet y movil.

---

## 1. Migracion SQL: Agregar columna `view_count`

Agregar una columna `view_count` a `medical_news` para poder ordenar por "mas leidos". Se incrementara cada vez que un usuario abra un articulo.

```text
ALTER TABLE medical_news ADD COLUMN view_count integer NOT NULL DEFAULT 0;
```

---

## 2. Pagina de Noticias Medicas (`src/pages/MedicalNews.tsx`)

### Paginacion de 15 en 15
- Agregar estados: `page` (numero de pagina actual), `totalCount` (total de noticias)
- Cambiar la query para usar `.range(from, to)` con `from = page * 15` y `to = (page + 1) * 15 - 1`
- Agregar componente de paginacion al final usando los componentes `Pagination` existentes
- Mostrar indicador de "Pagina X de Y" compacto en movil

### Filtros avanzados (sorting)
- Agregar un nuevo estado `sortBy` con opciones:
  - `recent` (por defecto) -- ordenar por `published_at DESC`
  - `most_read` -- ordenar por `view_count DESC`
  - `most_commented` -- ordenar por conteo de comentarios (calculado client-side tras fetch, o con un sort local)
- UI: Fila de chips/botones debajo de la barra de busqueda, antes de las categorias
- En movil: Scroll horizontal para los filtros de ordenamiento

### Mejoras UX/UI completas
- **Primer articulo destacado (hero)**: En desktop/tablet, el primer articulo de la primera pagina se muestra en formato hero (full-width, imagen grande, titulo grande), el resto en grid de 3 columnas
- **Grid responsivo**: 1 columna en movil, 2 en tablet, 3 en desktop
- **Cards mejoradas**: Agregar badge de view_count ("X lecturas"), comentarios mas visibles, animaciones suaves
- **Filtros con scroll horizontal en movil**: Las categorias y filtros de sort usan `overflow-x-auto` con `scrollbar-hide`
- **Skeleton loading**: Mostrar skeleton cards durante la carga en lugar del spinner centrado
- **Paginacion compacta en movil**: Solo flechas prev/next con numero de pagina actual, en desktop se muestran numeros de pagina

---

## 3. Feed de Noticias en Landing (`src/components/news/NewsFeed.tsx`)

- Aumentar el `limit` de 6 a 15
- Agregar boton "Leer mas noticias" al final que navega a `/news`
- Layout: Mostrar las primeras 3 como cards grandes (visible), las siguientes como lista compacta (titulo + fecha + categoria)
- Boton con estilo destacado: icono de periodico + texto + flecha

---

## 4. Incrementar view_count al abrir articulo (`src/pages/NewsArticle.tsx`)

- Al cargar un articulo, ejecutar un `supabase.rpc` o un `UPDATE` para incrementar `view_count`
- Usar un approach simple: `UPDATE medical_news SET view_count = view_count + 1 WHERE id = article.id`
- Esto requiere que la RLS permita a cualquier autenticado hacer update solo de `view_count`, o usar una funcion RPC con `SECURITY DEFINER`

### Funcion SQL RPC (en la migracion)

```text
CREATE OR REPLACE FUNCTION increment_news_view(news_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE medical_news SET view_count = view_count + 1 WHERE id = news_id AND is_published = true;
$$;
```

---

## 5. Mostrar lecturas en el articulo y listado

- En `NewsArticle.tsx`: Mostrar "X lecturas" junto a la fecha
- En `MedicalNews.tsx`: Mostrar "X lecturas" en las cards junto a los comentarios

---

## Resumen de archivos

**Migracion SQL (1)**:
- Agregar columna `view_count` a `medical_news`
- Crear funcion RPC `increment_news_view`

**Archivos modificados (3)**:
- `src/pages/MedicalNews.tsx` -- Paginacion 15 en 15, filtros avanzados (recientes, mas leidos, mas comentados), hero card, skeleton loading, paginacion responsive
- `src/components/news/NewsFeed.tsx` -- Aumentar a 15 items, boton "Leer mas noticias", layout mixto cards+lista
- `src/pages/NewsArticle.tsx` -- Llamar `increment_news_view` al cargar, mostrar conteo de lecturas

**Sin archivos nuevos** -- se reutilizan componentes existentes (Pagination, Skeleton, Badge, etc.)

---

## Detalles tecnicos de paginacion

```text
// Estado
const [page, setPage] = useState(0);
const [totalCount, setTotalCount] = useState(0);
const PAGE_SIZE = 15;

// Query con rango
const from = page * PAGE_SIZE;
const to = from + PAGE_SIZE - 1;

const { data, count } = await supabase
  .from('medical_news')
  .select('...', { count: 'exact' })
  .eq('is_published', true)
  .order(sortColumn, { ascending: false })
  .range(from, to);

// Total de paginas
const totalPages = Math.ceil(totalCount / PAGE_SIZE);
```

Los filtros de categoria y busqueda se aplican como condiciones adicionales en la query (server-side), no client-side, para que la paginacion sea correcta.

