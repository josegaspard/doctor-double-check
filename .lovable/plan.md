
# Plan: Optimizacion UX/UI Movil - Panel Doctor, Footer, Noticias, Wallet

## 1. Email History Card - Optimizacion movil (`EmailHistoryCard.tsx`)

**Problema**: En movil el header se desborda -- "Historial de Emails", "Seleccionar todo", icono de descarga, icono de filtro y badges de conteo se amontonan en una sola linea.

**Solucion**:
- Reestructurar el header en 2 filas en movil: titulo arriba, acciones abajo
- Usar `flex-wrap` y reorganizar los botones de accion en una fila compacta
- Reducir el texto "Seleccionar todo" a solo un icono en movil (CheckSquare)
- Las badges de conteo (sent/failed) se colocan junto al titulo
- Botones de accion (CSV, filtros, seleccionar) en una fila separada debajo del titulo en movil

## 2. Mi Contenido - Cards optimizadas movil (`DoctorUpload.tsx`)

**Problema**: Las cards de contenido muestran badges (categoria, audiencia, fecha, publico/privado) que se amontonan y desbordan en movil. El texto se corta y los badges se superponen.

**Solucion**:
- Cambiar el layout de cada card a vertical en movil (stack) en lugar de horizontal
- Icono + titulo en la primera fila
- Badges (categoria, audiencia) en segunda fila con `flex-wrap` y `gap-1.5`
- Fecha + estado publico/privado en tercera fila
- En desktop mantener el layout horizontal actual
- Asegurar touch targets de 44px para el boton de eliminar

## 3. Push Notification Toggle - Badge "Bloqueado" (`PushNotificationToggle.tsx`)

**Problema**: El badge "Bloqueado" se ve mal en movil, con texto cortado.

**Solucion**:
- Cambiar el badge de `variant="destructive"` a un estilo mas compacto con `text-xs` asegurado
- Usar `shrink-0` en el badge para que no se comprima
- Reducir el texto de descripcion para que no empuje el badge fuera de pantalla

## 4. Footer App Completo (`UnifiedFooter.tsx`)

**Problema**: El footer del app no muestra la descripcion de marca ni las redes sociales de forma visible. Ademas esta oculto en movil (`hidden sm:block`).

**Solucion**:
- Mostrar el footer tambien en movil pero con padding inferior para no chocar con la barra de navegacion (pb-20)
- Agregar la descripcion de marca (`brandDescription`) debajo del logo en la variante app
- Asegurar que las redes sociales, copyright y status badge estan presentes
- En movil: layout de 1 columna con secciones colapsadas (logo+redes arriba, links en 2 columnas, copyright abajo)
- Mantener todo administrable desde `site_settings`

## 5. News Feed Grid - Mejor layout (`NewsFeed.tsx`)

**Problema**: El grid de noticias en el home no convence visualmente.

**Solucion**:
- Cambiar a un layout "magazine" para las primeras 3 noticias: la primera noticia ocupa 2 columnas (hero) y las 2 siguientes en columna derecha (stack)
- En movil: mantener 1 columna pero la primera noticia con imagen mas grande
- Mejorar las cards con gradiente sutil, sombras hover mas pronunciadas
- Compact list items con mejor espaciado y separadores visuales

## 6. Wallet/Transaction History - Optimizacion movil (`TransactionHistory.tsx`)

**Problema**: Las transacciones en movil se ven amontonadas, badges ("Compra") se corta, texto largo se desborda.

**Solucion**:
- Reorganizar cada transaccion en movil: icono + descripcion en primera linea, fecha + monto + badge en segunda linea
- Reducir el tamano del icono circular a `w-8 h-8` en movil
- Badges de tipo mas compactos con `text-[10px]` en movil
- Ocultar el badge de tipo en la lista (solo mostrar en el dialogo de detalle) para ahorrar espacio en movil
- Monto alineado a la derecha con tamano reducido en movil

## Resumen de archivos a modificar (6)

1. `src/components/doctor/EmailHistoryCard.tsx` -- Header responsive 2 filas en movil
2. `src/pages/DoctorUpload.tsx` -- Cards de contenido con layout vertical en movil
3. `src/components/notifications/PushNotificationToggle.tsx` -- Badge compacto
4. `src/components/layout/UnifiedFooter.tsx` -- Footer completo con descripcion, visible en movil
5. `src/components/news/NewsFeed.tsx` -- Layout magazine para noticias
6. `src/components/wallet/TransactionHistory.tsx` -- Transacciones responsive

**Sin migraciones SQL ni archivos nuevos.**

---

## Detalles tecnicos

### News Feed Magazine Layout
```text
Desktop (lg):
[  Hero (col-span-2)  ] [ Card 2 ]
[                      ] [ Card 3 ]

Tablet (sm):
[ Card 1 ] [ Card 2 ]
[ Card 3 ]

Movil:
[ Card 1 (hero grande) ]
[ Card 2 ]
[ Card 3 ]
```

### Footer App Movil
```text
[ Logo ]
[ Brand description text ]
[ Redes sociales iconos ]
---
[ Plataforma | Recursos ]
[ Legal ]
---
[ Copyright ]
[ Status badge ]
```

Se usa `pb-20` en movil para no chocar con la barra de navegacion inferior.

### EmailHistoryCard Header Movil
```text
[ Mail icon ] Historial de Emails  [sent badge] [failed badge]
[ Select ] [ CSV ] [ Filter ]   (segunda fila)
```
