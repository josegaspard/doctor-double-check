import React from 'react';
import { useCurrency, COUNTRY_CURRENCIES } from '@/hooks/useCurrency';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface CurrencySelectorProps {
  className?: string;
  size?: 'sm' | 'md';
}

export function CurrencySelector({ className, size = 'md' }: CurrencySelectorProps) {
  const { userCurrency, userFlag, setPreferredCurrency } = useCurrency();
  const qc = useQueryClient();

  const unique = Array.from(
    new Map(Object.values(COUNTRY_CURRENCIES).map(c => [c.currency, c])).values(),
  ).sort((a, b) => a.currency.localeCompare(b.currency));

  const handleChange = async (currency: string) => {
    await setPreferredCurrency(currency);
    await qc.invalidateQueries({ queryKey: ['preferred-currency'] });
    toast.success(`Moneda actualizada a ${currency}`);
  };

  return (
    <Select value={userCurrency} onValueChange={handleChange}>
      <SelectTrigger className={`${size === 'sm' ? 'h-8 text-xs' : 'h-9'} ${className || ''}`}>
        <SelectValue>
          <span className="inline-flex items-center gap-1.5">
            <span>{userFlag}</span>
            <span>{userCurrency}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {unique.map(c => (
          <SelectItem key={c.currency} value={c.currency}>
            <span className="inline-flex items-center gap-2">
              <span>{c.flag}</span>
              <span className="font-mono text-xs">{c.currency}</span>
              <span className="text-muted-foreground text-xs">— {c.name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
