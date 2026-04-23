import React from 'react';
import { useSiteToggles } from '@/hooks/useSiteToggles';
import { DecorativeBackground } from '@/components/layout/DecorativeBackground';

// 🎨 FUENTE ÚNICA DEL FONDO DE LA APP
// La imagen vive en `public/app-bg.jpg` (servida directamente sin hash) y se
// pre-carga desde `index.html` con <link rel="preload"> para máxima velocidad.
// Para cambiarla:
//   - Reemplaza el archivo `public/app-bg.jpg`, o
//   - Cambia la constante BG_URL de abajo.
const BG_URL = '/app-bg.jpg';

interface AppBackgroundProps {
  children: React.ReactNode;
  className?: string;
  /**
   * Si true, no renderiza el overlay oscuro (útil cuando ya hay otro overlay encima).
   */
  withoutOverlay?: boolean;
}

/**
 * Wrapper único que aplica el fondo global de la app:
 * - Modo "image" (default): color sólido `#0b1d45` como fallback inmediato
 *   + imagen azul + overlay sutil + clase `.app-bg-image`
 *   (CSS en index.css refuerza contraste de títulos, links, botones, iconos, etc.)
 * - Modo "white" (toggle admin): degradado claro + DecorativeBackground.
 *
 * Usado por MainLayout y por todas las pantallas standalone.
 */
export const AppBackground = React.forwardRef<HTMLDivElement, AppBackgroundProps>(
  function AppBackground({ children, className = '', withoutOverlay = false }, ref) {
    const { toggles } = useSiteToggles();
    const useImageBackground = (toggles as any).app_background !== 'white';

    return (
      <div
        ref={ref}
        className={`relative ${
          useImageBackground
            ? 'app-bg-image'
            : 'bg-gradient-to-br from-primary/[0.02] via-secondary/[0.01] to-primary/[0.02]'
        } ${className}`}
        style={
          useImageBackground
            ? {
                // Color sólido bajo la imagen → cero pantalla blanca antes de descargar
                backgroundColor: '#0b1d45',
                backgroundImage: `url(${BG_URL})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                // attachment se controla por CSS (fixed en desktop, scroll en móvil)
                backgroundRepeat: 'no-repeat',
              }
            : undefined
        }
      >
        {useImageBackground && !withoutOverlay && (
          <div
            aria-hidden="true"
            className="fixed inset-0 pointer-events-none z-0 bg-black/30"
          />
        )}
        {!useImageBackground && <DecorativeBackground />}
        {children}
      </div>
    );
  }
);

export default AppBackground;
