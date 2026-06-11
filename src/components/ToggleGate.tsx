import React from 'react';
import { useSiteToggles, type SiteToggles } from '@/hooks/useSiteToggles';
import FeatureUnavailable from '@/pages/FeatureUnavailable';

type FeatureKey = 'chat' | 'prescriptions' | 'videoCalls' | 'marketplace' | 'lives' | 'events' | 'vault' | 'recordings';

/**
 * Gatea una ruta según un toggle del admin (site_settings/feature_toggles).
 * - Si el toggle está activo → renderiza la página real.
 * - Si está inactivo → muestra "temporalmente no disponible".
 * - Mientras cargan los toggles → null (breve; evita parpadeo de "no disponible").
 *
 * El admin enciende/apaga estas funciones con 1 switch en Ajustes del sitio,
 * igual que la publicidad. Por defecto están DESACTIVADAS.
 */
export function ToggleGate({
  toggleKey,
  feature,
  children,
}: {
  toggleKey: keyof SiteToggles;
  feature: FeatureKey;
  children: React.ReactNode;
}) {
  const { toggles, isLoading } = useSiteToggles();
  if (isLoading) return null;
  if (!toggles[toggleKey]) return <FeatureUnavailable feature={feature} />;
  return <>{children}</>;
}
