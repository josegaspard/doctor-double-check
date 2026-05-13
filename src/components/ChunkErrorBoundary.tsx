import React from 'react';
import { Loader2 } from 'lucide-react';

interface State {
  hasError: boolean;
  isChunkError: boolean;
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
  state: State = { hasError: false, isChunkError: false };

  static getDerivedStateFromError(error: unknown): State {
    const msg = (error as any)?.message?.toString() ?? '';
    const name = (error as any)?.name?.toString() ?? '';
    const isChunkError =
      /failed to fetch dynamically imported module/i.test(msg) ||
      /chunkloaderror/i.test(name) ||
      /loading chunk \d+ failed/i.test(msg) ||
      /importing a module script failed/i.test(msg);
    return { hasError: true, isChunkError };
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
    }
  }

  componentDidMount() {
    // Limpiar el flag de "ya recargué" cuando la app monta exitosamente.
    sessionStorage.removeItem('mm_chunk_reload_done');
  }

  render() {
    if (this.state.hasError) {
      if (this.state.isChunkError) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm">Actualizando aplicación…</p>
            </div>
          </div>
        );
      }
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-2xl font-bold text-foreground">Algo salió mal</h1>
            <p className="text-sm text-muted-foreground">
              Hubo un error inesperado. Recarga la página para volver a intentarlo.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90"
            >
              Recargar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
