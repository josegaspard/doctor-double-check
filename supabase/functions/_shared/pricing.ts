// Admin-editable pricing read from site_settings.subscription_pricing.
// EVERY field has a hard fallback to the historical hardcoded value, so a
// missing/malformed setting can never break a checkout — it just uses defaults.

export interface SubscriptionPricing {
  basic_cents: number;
  premium_cents: number;
  resident_discount_pct: number;          // 0..100
  premium_recording_discount_pct: number; // 0..100
}

export const PRICING_FALLBACK: SubscriptionPricing = {
  basic_cents: 9900,
  premium_cents: 19900,
  resident_discount_pct: 50,
  premium_recording_discount_pct: 20,
};

function clampPct(n: unknown, fb: number): number {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0 || v > 100) return fb;
  return v;
}
function posCents(n: unknown, fb: number): number {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return fb;
  return Math.round(v);
}

// db = a supabase client (service role) with a .from() method.
export async function getSubscriptionPricing(db: any): Promise<SubscriptionPricing> {
  try {
    const { data } = await db
      .from("site_settings")
      .select("value")
      .eq("id", "subscription_pricing")
      .maybeSingle();
    const v = (data?.value ?? {}) as Partial<SubscriptionPricing>;
    return {
      basic_cents: posCents(v.basic_cents, PRICING_FALLBACK.basic_cents),
      premium_cents: posCents(v.premium_cents, PRICING_FALLBACK.premium_cents),
      resident_discount_pct: clampPct(v.resident_discount_pct, PRICING_FALLBACK.resident_discount_pct),
      premium_recording_discount_pct: clampPct(v.premium_recording_discount_pct, PRICING_FALLBACK.premium_recording_discount_pct),
    };
  } catch {
    return PRICING_FALLBACK;
  }
}

// Multiplier to apply a resident discount, e.g. 0.5 for 50% off.
export function residentMultiplier(p: SubscriptionPricing): number {
  return 1 - p.resident_discount_pct / 100;
}
