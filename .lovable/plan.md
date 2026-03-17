

# Fix: Mobile audio button + fullscreen on iOS/Android

## Bugs found

1. **CSS fullscreen cannot exit on iOS** — `toggleFullscreen` has no path to undo the CSS fallback. Clicking minimize on iOS does nothing.
2. **Controls invisible on mobile** — `opacity-0 group-hover:opacity-100` requires hover; touch devices never trigger this, so buttons are hidden outside fullscreen.
3. **Audio icon state mismatch** — `viewerAudioMuted` starts `false` (showing Volume2 icon) but elements start `muted = true`. Misleading UI.

## Changes (single file: `DailyVideoPlayer.tsx`)

### 1. Fix CSS fullscreen exit
Add an early check in `toggleFullscreen`: if `isFullscreen` is true but no native fullscreen element exists, it's a CSS fullscreen — toggle it off:

```tsx
const toggleFullscreen = useCallback(() => {
  const el = wrapperRef.current;
  if (!el) return;

  // Exit native fullscreen
  if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
    (document.exitFullscreen?.() || (document as any).webkitExitFullscreen?.());
    return;
  }

  // Exit CSS fallback fullscreen (iOS)
  if (isFullscreen) {
    setIsFullscreen(false);
    document.body.style.overflow = '';
    return;
  }

  // Enter native fullscreen, fallback to CSS
  const requestFs = el.requestFullscreen?.bind(el) || (el as any).webkitRequestFullscreen?.bind(el);
  if (requestFs) {
    requestFs().catch(() => {
      setIsFullscreen(true);
      document.body.style.overflow = 'hidden';
    });
  } else {
    setIsFullscreen(true);
    document.body.style.overflow = 'hidden';
  }
}, [isFullscreen]);
```

### 2. Fix controls visibility on mobile
Change the controls bar from hover-only to always visible on touch/mobile. Replace the opacity logic:
- Non-fullscreen: `opacity-0 group-hover:opacity-100` → add `sm:opacity-0 sm:group-hover:opacity-100` (always visible on mobile, hover-reveal on desktop)
- Or simpler: detect touch and keep `opacity-100`

### 3. Fix audio icon initial state
Change `viewerAudioMuted` initial value to `true` since elements start muted:
```tsx
const [viewerAudioMuted, setViewerAudioMuted] = useState(true);
```

## Result
- iOS: CSS fullscreen enters and exits correctly
- Android: native fullscreen works as before
- Audio button visible and correctly reflects muted state on all devices
- Controls always visible on mobile screens

