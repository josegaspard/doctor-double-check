import React from 'react';
import { useSiteToggles } from '@/hooks/useSiteToggles';
import { DecorativeBackground } from '@/components/layout/DecorativeBackground';
// 🎨 FUENTE ÚNICA DEL FONDO DE LA APP
// Para cambiar la imagen: reemplaza este archivo o cambia la ruta del import.
import appBackground from '@/assets/app-background.jpg';

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
 * - Modo "image" (default): imagen azul fija + overlay sutil + clase `.app-bg-image`
 *   (CSS en index.css refuerza contraste de títulos, links, botones ghost, etc.)
 * - Modo "white" (toggle admin): degradado claro + DecorativeBackground.
 *
 * Usado por MainLayout y por todas las pantallas standalone (Login, Onboarding,
 * ResetPassword, EmailConfirmed, RoleSelector, VerificationPending, AccessDenied,
 * NotFound) para garantizar que NO existan pantallas en blanco.
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
                backgroundImage: `url(${appBackground})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundAttachment: 'fixed',
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
