
# Plan: Ganancias clickable, estilos Saldo/Wallet, y navegacion visitante

## 1. Hacer la card "Ganancias" clickable en el dashboard del doctor

**Archivo**: `src/components/doctor/EarningsCard.tsx`

- Envolver toda la Card en un elemento clickable que navegue a `/doctor/earnings`
- Agregar `cursor-pointer` y efecto `hover:shadow-md` a la Card
- Agregar un indicador visual (flecha o chevron) en el header para indicar que es clickable

## 2. Agregar fondo suave a "Saldo" (doctor) y "Wallet" (paciente) en el menu movil "Mas"

**Archivo**: `src/components/layout/MainLayout.tsx` (lineas 618-643)

- Agregar `bg-success/10 border border-success/20` al item de "Saldo" del doctor para que destaque visualmente como boton clickable
- Agregar `bg-primary/10 border border-primary/20` al item de "Wallet" del paciente
- Esto hara que ambos items se diferencien del resto de la navegacion y sea obvio que son interactivos

## 3. Navegacion para visitantes (no logueados)

**Archivo**: `src/components/layout/MainLayout.tsx`

### Bottom tabs (lineas 117-124):
- Cambiar el bloque `visitor/resident` para que visitantes solo vean: **Lives** y **Noticias** (2 tabs + "Mas")
- Quitar "Doctores" y "Notificaciones" de los bottom tabs para visitantes

### navItems (linea 69-82):
- Ya esta correcto: visitor solo tiene `lives` y `news`

### Header (linea 392):
- Solo mostrar NotificationBell si `isAuthenticated` (ya esta asi)
- Ocultar boton de busqueda/doctores para visitantes no autenticados

### More sheet para visitante (lineas 567-575):
- El visitor ya ve login prompt + solo items de navegacion filtrados por rol (lives, news)
- Verificar que "Notificaciones" no aparezca para visitors en el More sheet (linea 644-658): esta dentro de `isAuthenticated && role !== 'visitor'`, ya esta correcto

### Separar visitor de resident en getBottomTabs:
- Resident mantiene tabs completos (Lives, Doctores, Notificaciones, Perfil)
- Visitor solo: Lives, Noticias (sin Doctores ni Notificaciones)

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/doctor/EarningsCard.tsx` | Card clickable con hover, navega a `/doctor/earnings` |
| `src/components/layout/MainLayout.tsx` | Fondo suave en Saldo/Wallet, bottom tabs visitante simplificados |

## Detalle tecnico

### getBottomTabs - nuevo bloque visitor:
```text
visitor:
  - Lives (Radio icon)
  - Noticias (Calendar icon)
  (+ boton "Mas" con login prompt)

resident (sin cambios):
  - Lives
  - Doctores
  - Notificaciones
  - Perfil
```

### EarningsCard clickable:
La Card completa sera un div con `onClick={() => navigate('/doctor/earnings')}` y estilos de hover para indicar interactividad. Se agrega una flecha `ChevronRight` en el header.
