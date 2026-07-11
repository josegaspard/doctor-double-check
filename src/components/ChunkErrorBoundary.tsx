import React from 'react';
import { Loader2, Radio } from 'lucide-react';
import { t as translate, type SupportedLanguage } from '@/lib/i18n';

// Class component sin acceso al hook useLanguage: resolvemos el idioma desde
// localStorage (misma clave que LanguageContext) y traducimos con el helper puro.
const tr = (path: string): string => {
  let lang: SupportedLanguage = 'es';
  try {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('preferred_language') : null;
    if (stored) lang = stored.slice(0, 2).toLowerCase() as SupportedLanguage;
  } catch { /* localStorage no disponible */ }
  return translate(lang, path);
};

interface State {
  hasError: boolean;
  isChunkError: boolean;
  isLiveRoute: boolean;
  liveCountdown: number;
  errorMsg: string;
  errorStack: string;
}

/**
 * ErrorBoundary global que captura errores de carga de chunks lazy.
 * Causa #1 de "pantalla en blanco al cambiar de ruta": el usuario tiene una
 * pestaña abierta de una build vieja, hacemos deploy → los hashes de chunk
 * cambian → la nueva ruta intenta cargar un .js que ya no existe → fail
 * silencioso. Aquí detectamos esos errores específicos (mensajes típicos:
 * "Failed to fetch dynamically imported module", "ChunkLoadError", "Loading
 * chunk N failed") y forzamos un reload, que descarga el index.html nuevo
 * con los hashes actuales.
 *
 * Para errores reales (no de chunk) mostramos un fallback con botón de
 * recarga manual.
 */
export class ChunkErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, isChunkError: false, isLiveRoute: false, liveCountdown: 6, errorMsg: '', errorStack: '' };
  private countdownTimer: ReturnType<typeof setInterval> | null = null;

  static getDerivedStateFromError(error: unknown): State {
    const msg = (error as any)?.message?.toString() ?? '';
    const name = (error as any)?.name?.toString() ?? '';
    const stack = (error as any)?.stack?.toString() ?? '';
    const isChunkError =
      /failed to fetch dynamically imported module/i.test(msg) ||
      /chunkloaderror/i.test(name) ||
      /loading chunk \d+ failed/i.test(msg) ||
      /importing a module script failed/i.test(msg);
    const isLiveRoute = typeof window !== 'undefined' && /^\/live\//.test(window.location.pathname);
    return { hasError: true, isChunkError, isLiveRoute, liveCountdown: 6, errorMsg: `${name}: ${msg}`, errorStack: stack };
  }

  componentDidCatch(error: unknown) {
    console.error('[ChunkErrorBoundary]', error);
    if (this.state.isChunkError) {
      // Auto-reload tras un breve delay para que el usuario vea brevemente el loader.
      // sessionStorage previene loops infinitos si el reload no resuelve.
      const reloadedKey = 'mm_chunk_reload_done';
      if (!sessionStorage.getItem(reloadedKey)) {
        sessionStorage.setItem(reloadedKey, '1');
        setTimeout(() => window.location.reload(), 250);
      } else {
        // Si ya recargamos antes y sigue fallando, mostramos el fallback manual.
        sessionStorage.removeItem(reloadedKey);
      }
      return;
    }

    if (this.state.isLiveRoute) {
      // Auto-redirect a /lives en 6 segundos, mostrando countdown.
      this.countdownTimer = setInterval(() => {
        this.setState((s) => {
          const next = s.liveCountdown - 1;
          if (next <= 0) {
            if (this.countdownTimer) clearInterval(this.countdownTimer);
            // Hard navigate para resetear toda la state corrupta.
            window.location.href = '/lives';
            return s;
          }
          return { ...s, liveCountdown: next };
        });
      }, 1000);
    }
  }

  componentDidMount() {
    // Limpiar el flag de "ya recargué" cuando la app monta exitosamente.
    sessionStorage.removeItem('mm_chunk_reload_done');
  }

  componentWillUnmount() {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
  }

  render() {
    if (this.state.hasError) {
      if (this.state.isChunkError) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm">{tr('chunkError.updating')}</p>
            </div>
          </div>
        );
      }
      if (this.state.isLiveRoute) {
        // Fallback amigable cuando el live se cae/termina inesperadamente.
        return (
          <div className="min-h-screen flex items-center justify-center bg-background p-6">
            <div className="max-w-sm w-full text-center space-y-5 bg-card rounded-2xl p-8 shadow-xl border border-border">
              <div className="w-14 h-14 mx-auto rounded-full bg-primary/15 flex items-center justify-center">
                <Radio className="w-7 h-7 text-primary" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-foreground">{tr('chunkError.streamEnded')}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {tr('chunkError.streamEndedDesc')}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-primary font-medium">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{tr('chunkError.redirecting').replace('{seconds}', String(this.state.liveCountdown))}</span>
              </div>
              <button
                onClick={() => { window.location.href = '/lives'; }}
                className="w-full inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold hover:bg-primary/90"
              >
                {tr('chunkError.goToLivesNow')}
              </button>
            </div>
          </div>
        );
      }
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-2xl w-full text-center space-y-4">
            <h1 className="text-2xl font-bold text-foreground">{tr('chunkError.somethingWrong')}</h1>
            <p className="text-sm text-muted-foreground">
              {tr('chunkError.unexpectedError')}
            </p>
            {this.state.errorMsg && (
              <details className="text-left mx-auto max-w-xl">
                <summary className="cursor-pointer text-xs text-primary font-semibold mb-2">{tr('chunkError.viewTechnical')}</summary>
                <pre className="text-[10px] whitespace-pre-wrap break-words bg-muted p-3 rounded-md text-foreground/80 overflow-x-auto max-h-[40vh]">
{this.state.errorMsg}
{'\n\n'}
{this.state.errorStack.split('\n').slice(0, 12).join('\n')}
                </pre>
              </details>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90"
            >
              {tr('chunkError.reload')}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
