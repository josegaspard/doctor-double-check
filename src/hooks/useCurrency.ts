import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Country → currency mapping
export const COUNTRY_CURRENCIES: Record<string, { currency: string; flag: string; name: string }> = {
  MX: { currency: 'MXN', flag: '🇲🇽', name: 'México' },
  US: { currency: 'USD', flag: '🇺🇸', name: 'Estados Unidos' },
  PE: { currency: 'PEN', flag: '🇵🇪', name: 'Perú' },
  CO: { currency: 'COP', flag: '🇨🇴', name: 'Colombia' },
  AR: { currency: 'ARS', flag: '🇦🇷', name: 'Argentina' },
  CL: { currency: 'CLP', flag: '🇨🇱', name: 'Chile' },
  BR: { currency: 'BRL', flag: '🇧🇷', name: 'Brasil' },
  EC: { currency: 'USD', flag: '🇪🇨', name: 'Ecuador' },
  UY: { currency: 'UYU', flag: '🇺🇾', name: 'Uruguay' },
  PY: { currency: 'PYG', flag: '🇵🇾', name: 'Paraguay' },
  BO: { currency: 'BOB', flag: '🇧🇴', name: 'Bolivia' },
  VE: { currency: 'USD', flag: '🇻🇪', name: 'Venezuela' },
  CR: { currency: 'CRC', flag: '🇨🇷', name: 'Costa Rica' },
  PA: { currency: 'PAB', flag: '🇵🇦', name: 'Panamá' },
  GT: { currency: 'GTQ', flag: '🇬🇹', name: 'Guatemala' },
  HN: { currency: 'HNL', flag: '🇭🇳', name: 'Honduras' },
  SV: { currency: 'USD', flag: '🇸🇻', name: 'El Salvador' },
  NI: { currency: 'NIO', flag: '🇳🇮', name: 'Nicaragua' },
  DO: { currency: 'DOP', flag: '🇩🇴', name: 'Rep. Dominicana' },
  CU: { currency: 'CUP', flag: '🇨🇺', name: 'Cuba' },
  ES: { currency: 'EUR', flag: '🇪🇸', name: 'España' },
  CA: { currency: 'CAD', flag: '🇨🇦', name: 'Canadá' },
  GB: { currency: 'GBP', flag: '🇬🇧', name: 'Reino Unido' },
};

// Detect country from browser locale
export function detectCountry(): string {
  const lang = navigator.language || navigator.languages?.[0] || 'es-MX';
  const parts = lang.split('-');
  const country = parts[1]?.toUpperCase();
  if (country && COUNTRY_CURRENCIES[country]) return country;
  // Fallback by language
  if (parts[0] === 'pt') return 'BR';
  return 'MX';
}

export function useCurrency() {
  const { user } = useAuth();
  // Manual override (profiles.preferred_currency) takes precedence over auto-detection
  const { data: preferred } = useQuery({
    queryKey: ['preferred-currency', (user as any)?.id],
    queryFn: async () => {
      if (!(user as any)?.id) return null;
      const { data } = await supabase.from('profiles').select('preferred_currency').eq('id', (user as any).id).single();
      return (data as any)?.preferred_currency || null;
    },
    enabled: !!(user as any)?.id,
    staleTime: 60 * 60 * 1000,
  });

  const userCurrency = preferred || (user as any)?.currencyCode || 'MXN';
  const userCountry = (user as any)?.countryCode || 'MX';
  // Flag follows manual currency selection when overridden
  const flagFromCurrency = Object.values(COUNTRY_CURRENCIES).find(c => c.currency === userCurrency)?.flag;
  const userFlag = (preferred && flagFromCurrency) || (user as any)?.countryFlag || '🇲🇽';

  const setPreferredCurrency = async (currency: string) => {
    if (!(user as any)?.id) return;
    await supabase.from('profiles').update({ preferred_currency: currency } as any).eq('id', (user as any).id);
  };

  const { data: rates } = useQuery({
    queryKey: ['exchange-rates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exchange_rates')
        .select('target_currency, rate');
      if (error) throw error;
      const map: Record<string, number> = {};
      data?.forEach(r => { map[r.target_currency] = Number(r.rate); });
      return map;
    },
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 2 * 60 * 60 * 1000,
  });

  const convertFromMXN = (amountMXN: number): number => {
    if (userCurrency === 'MXN' || !rates) return amountMXN;
    const rate = rates[userCurrency];
    if (!rate) return amountMXN;
    return amountMXN * rate;
  };

  const formatPrice = (amountMXN: number, showBoth = true): string => {
    const mxnFormatted = `$${amountMXN.toFixed(2)} MXN`;
    if (userCurrency === 'MXN' || !rates || !rates[userCurrency]) return mxnFormatted;
    const converted = convertFromMXN(amountMXN);
    const localFormatted = `${userFlag} $${converted.toFixed(2)} ${userCurrency}`;
    return showBoth ? `${localFormatted} (${mxnFormatted})` : localFormatted;
  };

  return {
    userCurrency,
    userCountry,
    userFlag,
    rates,
    convertFromMXN,
    formatPrice,
    setPreferredCurrency,
    isManualOverride: !!preferred,
  };
}
