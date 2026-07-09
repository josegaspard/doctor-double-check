/// <reference types="vite/client" />

// ScreenOrientation.lock/unlock son APIs experimentales no incluidas en lib.dom.
// Se usan con optional chaining en el modo fullscreen del video en vivo; declararlas
// evita los errores TS en DailyVideoPlayer/LiveStreamView/LivePlayer (runtime ya OK).
interface ScreenOrientation {
  lock?(orientation: 'any' | 'natural' | 'landscape' | 'portrait' | 'portrait-primary' | 'portrait-secondary' | 'landscape-primary' | 'landscape-secondary'): Promise<void>;
  unlock?(): void;
}
