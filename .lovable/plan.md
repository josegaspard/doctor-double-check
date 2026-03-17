

# Plan: Fullscreen tipo YouTube en móvil (landscape rotado)

## Problema actual

El fullscreen en móvil simplemente expande el video verticalmente (portrait), pero no fuerza la orientación landscape como YouTube. El usuario espera rotar el teléfono y ver el video en horizontal a pantalla completa.

## Solución

Usar la **Screen Orientation API** (`screen.orientation.lock('landscape')`) al entrar en fullscreen en móvil, y desbloquearla al salir. Esto funciona en Android y en iOS 16.4+ (Safari). Como fallback para iOS más viejo donde la API no está disponible, el CSS fallback ya existente rotará el contenedor 90° con `transform: rotate(90deg)`.

### Cambios en `src/components/live/DailyVideoPlayer.tsx`

**1. `toggleFullscreen` — forzar landscape al entrar:**

```tsx
const toggleFullscreen = useCallback(() => {
  const el = wrapperRef.current;
  if (!el) return;

  // Exit native fullscreen
  if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
    (document.exitFullscreen?.() || (document as any).webkitExitFullscreen?.());
    screen.orientation?.unlock?.();
    return;
  }

  // Exit CSS fallback (iOS)
  if (isFullscreen) {
    setIsFullscreen(false);
    document.body.style.overflow = '';
    screen.orientation?.unlock?.();
    return;
  }

  // Enter fullscreen
  const requestFs = el.requestFullscreen?.bind(el) || (el as any).webkitRequestFullscreen?.bind(el);
  if (requestFs) {
    requestFs().then(() => {
      screen.orientation?.lock?.('landscape').catch(() => {});
    }).catch(() => {
      // CSS fallback
      setIsFullscreen(true);
      document.body.style.overflow = 'hidden';
      screen.orientation?.lock?.('landscape').catch(() => {});
    });
  } else {
    setIsFullscreen(true);
    document.body.style.overflow = 'hidden';
    screen.orientation?.lock?.('landscape').catch(() => {});
  }
}, [isFullscreen]);
```

**2. Fullscreen change listener — unlock on exit:**

En el `useEffect` que escucha `fullscreenchange`, añadir `screen.orientation?.unlock?.()` cuando se sale de fullscreen.

**3. CSS fallback wrapper — rotate 90° en portrait como último recurso:**

Cuando `isFullscreen` es true via CSS fallback (no native), aplicar un estilo inline que rota el contenedor si la pantalla está en portrait:

```tsx
style={isFullscreen && !externalClassName ? {
  width: '100vw',
  height: '100dvh',
  // CSS rotation fallback for iOS when orientation lock unavailable
} : undefined}
```

Además, añadir una media query con `@media (orientation: portrait)` en el className del wrapper cuando está en CSS-fullscreen para rotar el contenido 90° y hacer swap de width/height.

### Cambios en `src/components/live/LiveStreamView.tsx`

En el className del `DailyVideoPlayer` para móvil cuando `isFullscreen`, aplicar las mismas clases de rotación landscape para que el video del doctor (owner) también se vea en landscape al poner pantalla completa.

## Archivos a modificar
1. `src/components/live/DailyVideoPlayer.tsx` — orientation lock + CSS rotation fallback
2. `src/components/live/LiveStreamView.tsx` — clases landscape en fullscreen móvil del owner

