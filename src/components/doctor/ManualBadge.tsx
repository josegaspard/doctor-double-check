import React from 'react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

// Iconos de insignia como imagen (cliente 2026-07-02): la palomita y la medalla
// dejan de ser iconos de librería y usan los PNG oficiales del cliente.
//   'verified' = palomita  -> /badge-verified.png
//   'gold'     = medalla    -> /badge-gold.png
const BADGE_IMG: Record<'gold' | 'verified', string> = {
  verified: '/badge-verified.png',
  gold: '/badge-gold.png',
};

interface ManualBadgeProps {
  /** Valor de doctor_profiles.manual_badge: 'gold' | 'verified' | null */
  badge?: string | null;
  size?: 'sm' | 'md' | 'lg';
  /** Solo el icono, sin texto */
  iconOnly?: boolean;
  className?: string;
}

/**
 * Distintivo manual elegido por el médico al verificarse (cliente 2026-06-29):
 *   'gold'     = 🥇 Medalla dorada (especialista con trayectoria)
 *   'verified' = 🛡️ Escudo verificado (líder de opinión) — antes palomita (cliente 2026-07-01)
 */
export function ManualBadge({ badge, size = 'md', iconOnly = false, className }: ManualBadgeProps) {
  const { t } = useLanguage();
  if (badge !== 'gold' && badge !== 'verified') return null;

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-[10px] gap-0.5',
    md: 'px-2 py-0.5 text-xs gap-1',
    lg: 'px-3 py-1 text-sm gap-1',
  };
  const iconSizes = { sm: 'w-3.5 h-3.5', md: 'w-4 h-4', lg: 'w-5 h-5' };
  // Solo-icono: mucho más grande para que el distintivo se note (cliente 2026-07-03).
  const iconOnlySizes = { sm: 'w-6 h-6', md: 'w-7 h-7', lg: 'w-9 h-9' };

  const isGold = badge === 'gold';
  const img = BADGE_IMG[badge];
  const label = isGold ? t('onboardingPage.badgeGold') : t('onboardingPage.badgeVerified');
  const colors = isGold
    ? 'bg-premium/15 text-premium border-premium/30'
    : 'bg-primary/10 text-primary border-primary/30';

  if (iconOnly) {
    return (
      <img
        src={img}
        alt={label}
        aria-label={label}
        title={label}
        className={cn(iconOnlySizes[size], 'object-contain shrink-0', className)}
      />
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-semibold border whitespace-nowrap shrink-0',
        colors,
        sizeClasses[size],
        className,
      )}
    >
      <img src={img} alt="" aria-hidden="true" className={cn(iconSizes[size], 'object-contain')} />
      {label}
    </span>
  );
}
