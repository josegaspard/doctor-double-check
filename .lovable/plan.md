

# Fix: Mobile fullscreen landscape rotation not working

## Root cause

The CSS rotation in `.landscape-fs` is broken because of conflicting styles:

1. **`inset-0`** generates `inset: 0px` (top/right/bottom/left = 0), which fights with the CSS `top: 50% !important; left: 50% !important` — the `right: 0` and `bottom: 0` remain unoverridden, constraining the element.
2. **Inline `style`** on line 483 sets `width: 100vw; height: 100dvh` — inline styles override class-based `!important` in some cases and conflict with the rotated dimensions (`width: 100dvh; height: 100vw`).
3. **`w-screen h-[100dvh]`** Tailwind classes also conflict with the CSS rotation dimension swap.

Result: the element goes fixed fullscreen but never rotates because the layout constraints prevent the transform from taking visual effect.

## Fix (2 files)

### 1. `src/components/live/DailyVideoPlayer.tsx`

- When fullscreen on mobile (CSS fallback), do NOT apply `inset-0`, `w-screen`, `h-[100dvh]`, or inline `style` — let the `.landscape-fs` CSS class handle all positioning/sizing.
- On desktop/native fullscreen, keep `inset-0` as before (no `landscape-fs` needed since native API handles orientation).
- Apply `landscape-fs` class only when using the CSS fallback (i.e., `isFullscreen` state is true but no native fullscreen element).

Change the wrapper className and style:

```tsx
className={externalClassName || `relative bg-black overflow-hidden group ${
  isFullscreen
    ? 'fixed z-[9999] rounded-none landscape-fs'
    : 'aspect-video rounded-xl'
}`}
style={isFullscreen && !externalClassName ? { inset: 0, width: '100vw', height: '100dvh' } : undefined}
```

Move `inset-0` and dimensions to inline style so `.landscape-fs` `!important` rules can override them cleanly in portrait mode.

### 2. `src/index.css`

Fix the `.landscape-fs` CSS to properly override all conflicting properties:

```css
@media (orientation: portrait) {
  .landscape-fs {
    transform: rotate(90deg) !important;
    transform-origin: center center !important;
    width: 100dvh !important;
    height: 100vw !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    inset: unset !important;
  }
}
```

This ensures the rotation and dimension swap override all inline and Tailwind styles on mobile portrait devices, while desktop/native fullscreen remains unaffected.

