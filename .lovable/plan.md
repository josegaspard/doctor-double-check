## Mejorar fondo de /doctor/go-live

El screenshot muestra que el contenido (tabs + cards) se pierde sobre el fondo azul oscuro plano del MainLayout — el contraste de las cards blancas no se acompaña de profundidad visual.

### Cambios (solo presentación, scope limitado a `src/pages/DoctorGoLive.tsx`)

Envolver el `return` final (estado "setup", líneas 479–496) y los estados de loading/no-doctor (408–434) en un wrapper con fondo propio que solo aplica a esta ruta:

```tsx
<MainLayout>
  <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
    {/* Capa 1: gradiente base */}
    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/5 pointer-events-none" />
    {/* Capa 2: orbes radiales suaves */}
    <div className="absolute top-0 -left-32 w-[500px] h-[500px] rounded-full bg-primary/15 blur-3xl pointer-events-none" />
    <div className="absolute bottom-0 -right-32 w-[600px] h-[600px] rounded-full bg-accent/10 blur-3xl pointer-events-none" />
    {/* Capa 3: grid pattern sutil */}
    <div
      className="absolute inset-0 opacity-[0.03] pointer-events-none"
      style={{
        backgroundImage:
          'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }}
    />
    {/* Contenido */}
    <div className="relative container mx-auto px-4 py-8 max-w-4xl">
      {/* Hero header de la página */}
      <div className="mb-6 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-3">
          <Radio className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-medium text-primary">Estudio en vivo</span>
        </div>
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">
          Comparte tu conocimiento
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Transmite ahora o programa una sesión para tu audiencia
        </p>
      </div>

      <Tabs defaultValue="now" className="w-full">
        {/* …tabs sin cambios… */}
      </Tabs>
    </div>
  </div>
</MainLayout>
```

### Detalles de la lógica de fondos

- Usa **solo tokens semánticos** (`primary`, `accent`, `background`, `foreground`) → respeta dark/light y memoria de design system.
- 3 capas (gradiente + 2 orbes blur + grid) → da profundidad sin imágenes pesadas.
- `pointer-events-none` en cada capa → no interfiere con clics.
- `min-h-[calc(100vh-4rem)]` cubre el viewport bajo el header.
- Wrapper aplica también a los estados loading / no-doctor para consistencia visual.
- Hero header refuerza identidad de "estudio" antes de los tabs (mejora UX/jerarquía).

### Scope
- 1 archivo: `src/pages/DoctorGoLive.tsx`.
- Sin cambios en lógica de negocio, sin nuevos componentes, sin cambios globales.
- No afecta el modo isLive (la transmisión activa mantiene su layout actual).
