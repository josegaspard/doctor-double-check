import React from 'react';
import { Award, BadgeCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

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
 *   'verified' = ✔️ Palomita      (líder de opinión)
 */
export function ManualBadge({ badge, size = 'md', iconOnly = false, className }: ManualBadgeProps) {
  const { t } = useLanguage();
  if (badge !== 'gold' && badge !== 'verified') return null;

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-[10px] gap-0.5',
    md: 'px-2 py-0.5 text-xs gap-1',
    lg: 'px-3 py-1 text-sm gap-1',
  };
  const iconSizes = { sm: 'w-2.5 h-2.5', md: 'w-3.5 h-3.5', lg: 'w-4 h-4' };

  const isGold = badge === 'gold';
  const Icon = isGold ? Award : BadgeCheck;
  const label = isGold ? t('onboardingPage.badgeGold') : t('onboardingPage.badgeVerified');
  const colors = isGold
    ? 'bg-premium/15 text-premium border-premium/30'
    : 'bg-primary/10 text-primary border-primary/30';

  if (iconOnly) {
    return <Icon className={cn(iconSizes[size], isGold ? 'text-premium' : 'text-primary', className)} aria-label={label} />;
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
      <Icon className={cn(iconSizes[size], isGold ? 'fill-premium/20' : '')} />
      {label}
    </span>
  );
}
