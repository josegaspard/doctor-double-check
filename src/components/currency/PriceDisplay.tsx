import React from 'react';
import { useCurrency } from '@/hooks/useCurrency';
import { cn } from '@/lib/utils';

interface PriceDisplayProps {
  amount: number; // in MXN
  className?: string;
  showBoth?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function PriceDisplay({ amount, className, showBoth = false, size = 'md' }: PriceDisplayProps) {
  const { userCurrency, userFlag, convertFromMXN, rates } = useCurrency();

  const isLocal = userCurrency === 'MXN' || !rates || !rates[userCurrency];
  const displayAmount = isLocal ? amount : convertFromMXN(amount);
  const displayCurrency = isLocal ? 'MXN' : userCurrency;

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base font-semibold',
  };

  return (
    <span className={cn('inline-flex items-center gap-1', sizeClasses[size], className)}>
      {!isLocal && <span>{userFlag}</span>}
      <span>${displayAmount.toFixed(2)}</span>
      <span className="text-muted-foreground">{displayCurrency}</span>
      {showBoth && !isLocal && (
        <span className="text-muted-foreground/60 text-[0.85em]">
          (${amount.toFixed(2)} MXN)
        </span>
      )}
    </span>
  );
}
