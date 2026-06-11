// Admin-editable app config (site_settings.app_config): currency code + amount
// limits. Every field falls back to the historical hardcoded value, so a missing
// or malformed setting can never break a checkout.

export interface AppConfig {
  currency: string;     // ISO code, lowercase, e.g. "mxn"
  wallet_min: number;
  wallet_max: number;
  ad_min: number;
  ad_max: number;
}

export const APP_CONFIG_FALLBACK: AppConfig = {
  currency: "mxn",
  wallet_min: 50,
  wallet_max: 999999,
  ad_min: 100,
  ad_max: 1000000,
};

function pos(n: unknown, fb: number): number {
  const v = Number(n);
  return Number.isFinite(v) && v >= 0 ? v : fb;
}

export async function getAppConfig(db: any): Promise<AppConfig> {
  try {
    const { data } = await db
      .from("site_settings")
      .select("value")
      .eq("id", "app_config")
      .maybeSingle();
    const v = (data?.value ?? {}) as Partial<AppConfig>;
    const cur = typeof v.currency === "string" && /^[a-z]{3}$/i.test(v.currency)
      ? v.currency.toLowerCase()
      : APP_CONFIG_FALLBACK.currency;
    return {
      currency: cur,
      wallet_min: pos(v.wallet_min, APP_CONFIG_FALLBACK.wallet_min),
      wallet_max: pos(v.wallet_max, APP_CONFIG_FALLBACK.wallet_max),
      ad_min: pos(v.ad_min, APP_CONFIG_FALLBACK.ad_min),
      ad_max: pos(v.ad_max, APP_CONFIG_FALLBACK.ad_max),
    };
  } catch {
    return APP_CONFIG_FALLBACK;
  }
}
