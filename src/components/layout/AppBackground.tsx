import React from 'react';
import { useSiteToggles } from '@/hooks/useSiteToggles';
import { DecorativeBackground } from '@/components/layout/DecorativeBackground';

// 🎨 FUENTE ÚNICA DEL FONDO DE LA APP — diseño aprobado por el cliente el
// 7-sep-2026 (panel de médico, lives, agenda y pacientes): teal profundo con
// resplandores y una malla de red sutil. Se pinta SOLO con CSS
// (`.app-bg-image` en index.css): sin rasters, cero peso extra y nítido en
// cualquier pantalla. El toggle de admin `app_background = 'white'` mantiene
// el modo claro de siempre.
interface AppBackgroundProps {
  children: React.ReactNode;
  className?: string;
  /** Conservado por compatibilidad con pantallas standalone; hoy no hay overlay. */
  withoutOverlay?: boolean;
}

export const AppBackground = React.forwardRef<HTMLDivElement, AppBackgroundProps>(
  function AppBackground({ children, className = '' }, ref) {
    const { toggles } = useSiteToggles();
    const useImageBackground = (toggles as any).app_background !== 'white';

    return (
      <div
        ref={ref}
        className={`relative ${
          useImageBackground
            ? 'app-bg-image pro-bg'
            : 'bg-gradient-to-br from-primary/[0.02] via-secondary/[0.01] to-primary/[0.02]'
        } ${className}`}
      >
        {!useImageBackground && <DecorativeBackground />}
        {children}
      </div>
    );
  }
);

export default AppBackground;
