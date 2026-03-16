
Implementaré dos ajustes puntuales:

1. `/content`: dejar publicidad solo abajo
- En `src/pages/ContentGallery.tsx` quitaré el banner superior `content_inline`.
- Mantendré el contenido principal igual y dejaré únicamente el banner inferior `content_bottom_banner`.
- No tocaré la lógica de cards/filtros ni el modal de preview.

2. Noticias: banners laterales realmente sticky en PC y tablet
Problema detectado:
- Ahora los laterales solo aparecen en `lg` (`hidden lg:block`), así que en tablet ni siquiera salen.
- Además hay sticky duplicado: el contenedor de `NewsArticle` ya intenta ser sticky, pero `AdBanner` también aplica `lg:sticky lg:top-4` a formatos verticales. Esa combinación puede romper el comportamiento esperado.
- El wrapper actual usa `overflow-y-auto`, lo que puede hacer que el banner se “encierre” en su propio scroll en vez de acompañar la página.

Cambios propuestos:
- En `src/pages/NewsArticle.tsx` cambiar el layout a sticky desde tablet:
  - usar columnas laterales desde `md` en vez de `lg`
  - ejemplo: `md:grid-cols-[160px_minmax(0,1fr)_160px] lg:grid-cols-[180px_minmax(0,1fr)_180px]`
- En ambos `<aside>` laterales:
  - cambiar `hidden lg:block` por `hidden md:block`
  - mantener `self-start`
  - usar un wrapper tipo `sticky top-20/24` sin `overflow-y-auto`, para que el banner siga el scroll del usuario
  - limitar naturalmente el sticky dentro del grid para que se detenga antes del footer
- En `src/components/ads/AdBanner.tsx` haré que el sticky automático del componente no interfiera con páginas que ya controlan ese comportamiento:
  - opción recomendada: agregar una prop tipo `disableAutoSticky` o `managedSticky`
  - en `NewsArticle` los banners laterales la usarán para que el sticky lo controle solo el layout del artículo
  - así evitamos side effects en otros placements verticales

Resultado esperado
- En `/content` ya no habrá banner arriba; solo abajo.
- En `/news/...` los banners laterales se verán en tablet y desktop.
- Se desplazarán junto con el usuario mientras lee.
- Se detendrán antes del footer porque quedarán contenidos dentro de la fila/grid del artículo, sin solaparse con el pie.

Archivos a tocar
- `src/pages/ContentGallery.tsx`
- `src/pages/NewsArticle.tsx`
- `src/components/ads/AdBanner.tsx`
