

# Mejora UX/UI de la página LivePlayer + Botón de cortar = Terminar Live

## Problema
La sidebar del LivePlayer tiene demasiadas cards apiladas (Doctor Info, Premium Recording, Panel del Doctor) que requieren scroll excesivo. Además, el botón de colgar llamada del DailyVideoPlayer no dispara el diálogo de "Terminar Live".

## Cambios

### 1. Botón de colgar = Terminar Live (`src/pages/LivePlayer.tsx`)
- Cambiar `onLeave={() => navigate('/lives')}` a `onLeave={() => setShowEndDialog(true)}` cuando `isOwner && isLiveActive`, para que el botón de cortar dentro del DailyVideoPlayer abra el mismo diálogo de confirmación de fin de transmisión.
- Para viewers, mantener `onLeave={() => navigate('/lives')}`.

### 2. Consolidar sidebar en layout compacto (`src/pages/LivePlayer.tsx`)

**Doctor Info Card** — compactar:
- Avatar + nombre + especialidad + verificado en una sola fila horizontal compacta
- Likes y Seguidores como badges inline en vez de grid 2x2 con números gigantes
- Botones "Ver Perfil" y "Chat privado" como botones pequeños inline

**Premium Recording Card** — reducir a un banner sutil de una línea dentro de la card del doctor o como un badge.

**Panel del Doctor** — eliminar la card separada, integrar el botón "Terminar Live" directamente en la barra de acciones superior (junto a Like, Share, Chat) como un botón destructive visible. Ya existe el botón de colgar en el video, así que el panel redundante se elimina.

**Layout resultante sidebar:**
```text
┌─────────────────────────┐
│ [Avatar] Dr. Nombre     │
│ Especialidad · ✓        │
│ ♡ 12  ★ 45              │
│ [Ver Perfil] [Chat 💬]  │
│ 🎬 Grabación premium    │
└─────────────────────────┘
```

**Mobile:** La sidebar se muestra como una franja compacta horizontal debajo del video, no como cards apiladas. El chat ocupa el espacio restante.

**Tablet/iPad:** Grid de 2 columnas con sidebar compacta.

### 3. Acciones del owner integradas en la barra de acciones
- Mover "Terminar Live" a la barra de botones debajo del video (donde están Like, Share, Chat) para owners, eliminando la card roja separada del "Panel del Doctor".

## Archivos a modificar
- **`src/pages/LivePlayer.tsx`** — Consolidar sidebar, integrar controles del doctor, conectar onLeave al diálogo de fin

