import React from 'react';
import { Star, Shield, Zap, Award, Crown, Gem } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DoctorRank } from '@/hooks/useDoctorRanks';

interface DoctorBadgeProps {
  rank?: DoctorRank | null;
  /** Legacy fallback */
  type?: 'pro' | 'new';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const iconMap: Record<string, React.ElementType> = {
  shield: Shield,
  zap: Zap,
  award: Award,
  star: Star,
  crown: Crown,
  gem: Gem,
};

const colorMap: Record<string, { bg: string; text: string; border: string; fill?: string }> = {
  info: { bg: 'bg-info/15', text: 'text-info', border: 'border-info/30' },
  success: { bg: 'bg-success/15', text: 'text-success', border: 'border-success/30' },
  warning: { bg: 'bg-warning/15', text: 'text-warning', border: 'border-warning/30' },
  premium: { bg: 'bg-premium/15', text: 'text-premium', border: 'border-premium/30', fill: 'fill-premium' },
  purple: { bg: 'bg-purple-500/15', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/30' },
};

export function DoctorBadge({ rank, type, size = 'md', className }: DoctorBadgeProps) {
  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-[10px] gap-0.5',
    md: 'px-2 py-0.5 text-xs gap-1',
    lg: 'px-3 py-1 text-sm gap-1.5',
  };

  const iconSizes = {
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  // New rank system
  if (rank) {
    const Icon = iconMap[rank.icon] || Shield;
    const colors = colorMap[rank.color] || colorMap.info;

    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full font-semibold border',
          colors.bg,
          colors.text,
          colors.border,
          sizeClasses[size],
          className,
        )}
      >
        <Icon className={cn(iconSizes[size], colors.fill)} />
        {rank.display_name}
      </span>
    );
  }

  // Legacy fallback
  if (type === 'pro') {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full font-semibold',
          'bg-premium/15 text-premium border border-premium/30',
          sizeClasses[size],
          className,
        )}
      >
        <Star className={cn(iconSizes[size], 'fill-premium')} />
        Doctor Pro
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-semibold',
        'bg-info/15 text-info border border-info/30',
        sizeClasses[size],
        className,
      )}
    >
      <Shield className={iconSizes[size]} />
      Nuevo
    </span>
  );
}

/**
 * Legacy helper - kept for backward compatibility
 */
export function getDoctorBadgeType(totalConsultations: number, rating: number, badgeOverride?: string | null): 'pro' | 'new' {
  if (badgeOverride === 'pro' || badgeOverride === 'new') return badgeOverride;
  if (totalConsultations >= 50 && rating >= 4.5) return 'pro';
  return 'new';
}
