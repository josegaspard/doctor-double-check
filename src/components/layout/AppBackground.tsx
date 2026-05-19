import React from 'react';
import { useSiteToggles } from '@/hooks/useSiteToggles';
import { DecorativeBackground } from '@/components/layout/DecorativeBackground';

// 🎨 FUENTE ÚNICA DEL FONDO DE LA APP — Brandbook 2026 (mundo conectado azul/teal).
// Existen 2 variantes en `public/`:
//   - app-bg.webp (60KB, q80, modern browsers)
//   - app-bg.jpg  (212KB, q78, fallback)
// El query `?v=...` invalida cache cuando se actualiza el asset.
// Para cambiar el fondo:
//   - Sustituye ambos archivos en public/ con la misma optimización, o
//   - Sube el número de versión BG_VERSION abajo.
const BG_VERSION = '20260519';
const BG_WEBP = `/app-bg.webp?v=${BG_VERSION}`;
const BG_JPG = `/app-bg.jpg?v=${BG_VERSION}`;
const BG_URL = BG_JPG;

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
                // image-set: WebP primero (modern), JPEG fallback (cualquier browser).
                // Se incluye también backgroundImage simple por si el navegador
                // ignora image-set sin prefijo (muy raro hoy).
                backgroundImage: `image-set(url("${BG_WEBP}") type("image/webp"), url("${BG_JPG}") type("image/jpeg")), url("${BG_URL}")`,
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
