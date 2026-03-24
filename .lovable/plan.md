

# Plan: Autoplay del video premium al terminar el preroll

## Problema
Cuando termina la publicidad preroll (o el usuario hace skip), el video de contenido premium se queda pausado mostrando el botón de play. El usuario quiere que el video empiece automáticamente.

## Solución
Pasar una prop `autoPlay` desde `RecordingPlayer` a `RecordingVideoPlayer` y luego a `CloudflareRecordingPlayer` (y al `<video>` de storage). El valor será `true` cuando el preroll haya terminado (`prerollDone === true`).

## Cambios

### 1. `src/pages/RecordingPlayer.tsx`
- Pasar `autoPlay={prerollDone}` a `<RecordingVideoPlayer>`

### 2. `src/components/recordings/RecordingVideoPlayer.tsx`
- Aceptar nueva prop `autoPlay?: boolean`
- Pasarla a `<CloudflareRecordingPlayer>` y al `<video>` de storage (`autoPlay` attribute)

### 3. `src/components/recordings/CloudflareRecordingPlayer.tsx`
- Aceptar nueva prop `autoPlay?: boolean`
- Cuando `autoPlay` es `true` y el video termina de cargar (`isLoading` pasa a `false`), llamar `videoRef.current.play()` automáticamente
- Esto hará que el video arranque sin necesidad de clic del usuario

## Archivos a modificar
1. `src/pages/RecordingPlayer.tsx` — pasar `autoPlay={prerollDone}`
2. `src/components/recordings/RecordingVideoPlayer.tsx` — aceptar y propagar `autoPlay`
3. `src/components/recordings/CloudflareRecordingPlayer.tsx` — implementar autoplay cuando prop es `true`

