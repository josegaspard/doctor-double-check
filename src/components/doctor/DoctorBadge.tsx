import React from 'react';
import { Star, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DoctorBadgeProps {
  type: 'pro' | 'new';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function DoctorBadge({ type, size = 'md', className }: DoctorBadgeProps) {
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

  if (type === 'pro') {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full font-semibold',
          'bg-premium/15 text-premium border border-premium/30',
          sizeClasses[size],
          className
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
        className
      )}
    >
      <Shield className={iconSizes[size]} />
      Nuevo
    </span>
  );
}

/**
 * Determine badge type based on doctor stats.
 * Pro = 50+ consultations AND rating >= 4.5
 * Otherwise = new
 */
export function getDoctorBadgeType(totalConsultations: number, rating: number): 'pro' | 'new' {
  if (totalConsultations >= 50 && rating >= 4.5) return 'pro';
  return 'new';
}
