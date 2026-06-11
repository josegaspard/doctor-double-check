import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Admin-editable pricing (site_settings.subscription_pricing). Mirrors the
// edge-function _shared/pricing.ts so the displayed price never diverges from
// what the backend actually charges. Every field falls back to the historical
// hardcoded value, so a missing setting changes nothing.
export interface SubscriptionPricing {
  basic_cents: number;
  premium_cents: number;
  resident_discount_pct: number;          // 0..100
  premium_recording_discount_pct: number; // 0..100
}

export const PRICING_DEFAULTS: SubscriptionPricing = {
  basic_cents: 9900,
  premium_cents: 19900,
  resident_discount_pct: 50,
  premium_recording_discount_pct: 20,
};

let cached: SubscriptionPricing | null = null;

function sanitize(v: Partial<SubscriptionPricing> | null | undefined): SubscriptionPricing {
  const num = (x: unknown, fb: number, max = Infinity) => {
    const n = Number(x);
    return Number.isFinite(n) && n >= 0 && n <= max ? n : fb;
  };
  return {
    basic_cents: num(v?.basic_cents, PRICING_DEFAULTS.basic_cents) || PRICING_DEFAULTS.basic_cents,
    premium_cents: num(v?.premium_cents, PRICING_DEFAULTS.premium_cents) || PRICING_DEFAULTS.premium_cents,
    resident_discount_pct: num(v?.resident_discount_pct, PRICING_DEFAULTS.resident_discount_pct, 100),
    premium_recording_discount_pct: num(v?.premium_recording_discount_pct, PRICING_DEFAULTS.premium_recording_discount_pct, 100),
  };
}

export function useSubscriptionPricing() {
  const [pricing, setPricing] = useState<SubscriptionPricing>(cached || PRICING_DEFAULTS);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('site_settings')
          .select('value')
          .eq('id', 'subscription_pricing')
          .maybeSingle();
        const p = sanitize(data?.value as Partial<SubscriptionPricing>);
        cached = p;
        if (active) setPricing(p);
      } catch {
        if (active) setPricing(PRICING_DEFAULTS);
      }
    })();
    return () => { active = false; };
  }, []);

  // Multipliers ready to use in display math.
  return {
    pricing,
    residentMultiplier: 1 - pricing.resident_discount_pct / 100,
    premiumRecordingMultiplier: 1 - pricing.premium_recording_discount_pct / 100,
  };
}
