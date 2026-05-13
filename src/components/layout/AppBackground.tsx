import React from 'react';
import { useSiteToggles } from '@/hooks/useSiteToggles';
import { DecorativeBackground } from '@/components/layout/DecorativeBackground';

// 🎨 FUENTE ÚNICA DEL FONDO DE LA APP — Brandbook 2026 (gradient Blue Lagoon → Uranus + marca M).
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
 * - Modo "image" (default): Blue Lagoon `#00768b` como fallback inmediato
 *   + brandbook gradient (Blue Lagoon → Uranus con marca M) + overlay Metallic Blue
 *   que oscurece la mitad clara del gradient para mantener contraste AA con
 *   tipografía blanca en chrome/hero.
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
                // Fallback Blue Lagoon (tono dominante del brandbook) — cero flash blanco
                backgroundColor: '#00768b',
                backgroundImage: `url(${BG_URL})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                // attachment se controla por CSS (fixed en desktop, scroll en móvil)
                backgroundRepeat: 'no-repeat',
              }
            : undefined
        }
      >
        {/* Overlay eliminado por orden del cliente: la imagen brandbook se muestra tal cual. */}
        {!useImageBackground && <DecorativeBackground />}
        {children}
      </div>
    );
  }
);

export default AppBackground;
